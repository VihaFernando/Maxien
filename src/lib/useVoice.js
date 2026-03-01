import { useState, useEffect, useRef, useCallback } from "react"

// ─── Format task/project information for natural speech output ───────────────
export function formatForSpeech(text) {
    // Handle common patterns and improve formatting for TTS

    // Format task/project status labels with proper names
    const statusMap = {
        "todo": "To Do",
        "to do": "To Do",
        "in progress": "In Progress",
        "done": "Done",
        "active": "Active",
        "on hold": "On Hold",
        "paused": "Paused",
        "completed": "Completed"
    }

    // Capitalize and format priority levels
    const priorityMap = {
        "high": "High",
        "medium": "Medium",
        "low": "Low"
    }

    // Better date formatting
    const dateRegex = /(\w+ \d{1,2}(?:st|nd|rd|th)?)/gi

    let formatted = text

    // Replace status labels
    Object.entries(statusMap).forEach(([from, to]) => {
        formatted = formatted.replace(new RegExp(`\\b${from}\\b`, "gi"), `Status: ${to}.`)
    })

    // Replace priority levels with clear announcement
    Object.entries(priorityMap).forEach(([from, to]) => {
        formatted = formatted.replace(new RegExp(`\\b${from}\\b`, "gi"), `Priority: ${to}.`)
    })

    // Add "Due date:" before date patterns
    formatted = formatted.replace(/(\d{1,2})[:\s]?(\d{2})(?:\s*(?:am|pm))?/gi, (match, hour, min) => {
        return `Due at ${hour}:${min}. `
    })

    // Improve spacing around punctuation for natural pauses
    formatted = formatted.replace(/\s{2,}/g, " ") // collapse extra spaces
    formatted = formatted.replace(/([.!?])\s*(?=[A-Z])/g, "$1 ") // ensure space after sentence ends

    return formatted
}

// ─── Strip markdown / symbols so TTS reads naturally ─────────────────────────
export function stripForSpeech(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, "$1")        // **bold**
        .replace(/\*(.*?)\*/g, "$1")             // *italic*
        .replace(/`([^`]+)`/g, "$1")             // `code`
        .replace(/#{1,6}\s+/g, "")               // headings
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [link](url)
        .replace(/^[•\-\*]\s/gm, ". ")          // bullets → periods (pauses)
        .replace(/^\d+\.\s/gm, "")              // numbered list
        .replace(/\n{2,}/g, ". ")               // paragraph breaks → pause
        .replace(/\n/g, ". ")                    // line breaks → pause for clarity
        .replace(/\s{2,}/g, " ")                 // collapse spaces
        .trim()
}

// ─── Pick the best Google voice available ─────────────────────────────────────
function getBestVoice(voices) {
    if (!voices.length) return null
    const checks = [
        v => /Google UK English Female/i.test(v.name),
        v => /Google US English/i.test(v.name),
        v => /Google.*English/i.test(v.name),
    ]
    for (const check of checks) {
        const match = voices.find(check)
        if (match) return match
    }
    return voices[0] || null
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useVoice() {
    const [isListening, setIsListening] = useState(false)
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [interimText, setInterimText] = useState("")
    // transcript: { text: string, id: number } — id changes each new result
    const [transcript, setTranscript] = useState(null)
    const [voiceEnabled, setVoiceEnabled] = useState(() => {
        try { return localStorage.getItem("maxien_voice_enabled") !== "false" } catch { return true }
    })
    const [availableVoices, setAvailableVoices] = useState([])
    const [selectedVoiceIndex, setSelectedVoiceIndex] = useState(() => {
        try { return parseInt(localStorage.getItem("maxien_voice_index") || "0") } catch { return 0 }
    })
    const [speechRate, setSpeechRate] = useState(() => {
        try { return parseFloat(localStorage.getItem("maxien_speech_rate") || "1") } catch { return 1 }
    })
    const [speechPitch, setSpeechPitch] = useState(() => {
        try { return parseFloat(localStorage.getItem("maxien_speech_pitch") || "1") } catch { return 1 }
    })
    const [speechVolume, setSpeechVolume] = useState(() => {
        try { return parseFloat(localStorage.getItem("maxien_speech_volume") || "1") } catch { return 1 }
    })
    const [sttSupported] = useState(() =>
        typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    )
    const [ttsSupported] = useState(() =>
        typeof window !== "undefined" && !!window.speechSynthesis
    )

    const recognitionRef = useRef(null)
    const voicesRef = useRef([])
    const voiceEnabledRef = useRef(voiceEnabled)

    // Keep ref in sync with state (avoids stale closure in speak())
    useEffect(() => { voiceEnabledRef.current = voiceEnabled }, [voiceEnabled])

    // Persist preferences
    useEffect(() => {
        try { localStorage.setItem("maxien_voice_enabled", String(voiceEnabled)) } catch { }
    }, [voiceEnabled])
    useEffect(() => {
        try { localStorage.setItem("maxien_voice_index", String(selectedVoiceIndex)) } catch { }
    }, [selectedVoiceIndex])
    useEffect(() => {
        try { localStorage.setItem("maxien_speech_rate", String(speechRate)) } catch { }
    }, [speechRate])
    useEffect(() => {
        try { localStorage.setItem("maxien_speech_pitch", String(speechPitch)) } catch { }
    }, [speechPitch])
    useEffect(() => {
        try { localStorage.setItem("maxien_speech_volume", String(speechVolume)) } catch { }
    }, [speechVolume])

    // Load TTS voices (Chrome requires waiting for voiceschanged event)
    useEffect(() => {
        if (!window.speechSynthesis) return
        const load = () => {
            const voices = window.speechSynthesis.getVoices()
            // Filter to Google English voices only (best natural sounding)
            const googleVoices = voices.filter(v => v.lang.startsWith("en") && /Google/i.test(v.name))
            voicesRef.current = googleVoices
            setAvailableVoices(googleVoices)
        }
        load()
        window.speechSynthesis.addEventListener("voiceschanged", load)
        return () => window.speechSynthesis.removeEventListener("voiceschanged", load)
    }, [])

    // Set up SpeechRecognition
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        if (!SpeechRecognition) return

        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = true
        recognition.lang = "en-US"
        recognition.maxAlternatives = 1

        recognition.onresult = (event) => {
            let interim = ""
            let final = ""
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const t = event.results[i][0].transcript
                if (event.results[i].isFinal) final += t
                else interim += t
            }
            if (interim) setInterimText(interim)
            if (final) {
                setInterimText("")
                setIsListening(false)
                setTranscript({ text: final.trim(), id: Date.now() })
            }
        }

        recognition.onspeechend = () => {
            try { recognition.stop() } catch { }
        }

        recognition.onerror = (e) => {
            console.warn("SpeechRecognition error:", e.error)
            setIsListening(false)
            setInterimText("")
        }

        recognition.onend = () => {
            setIsListening(false)
            setInterimText("")
        }

        recognitionRef.current = recognition
        return () => {
            try { recognition.abort() } catch { }
        }
    }, [])

    // ── startListening ────────────────────────────────────────────────────────
    const startListening = useCallback(() => {
        if (!recognitionRef.current) return
        window.speechSynthesis?.cancel()
        setIsSpeaking(false)
        try {
            recognitionRef.current.start()
            setIsListening(true)
            setInterimText("")
        } catch (e) {
            console.warn("Recognition start failed:", e)
        }
    }, [])

    // ── stopListening ─────────────────────────────────────────────────────────
    const stopListening = useCallback(() => {
        try { recognitionRef.current?.stop() } catch { }
        setIsListening(false)
        setInterimText("")
    }, [])

    // ── speak ─────────────────────────────────────────────────────────────────
    const speak = useCallback((text) => {
        if (!window.speechSynthesis || !voiceEnabledRef.current) return
        window.speechSynthesis.cancel()

        // First format for better speech, then strip markdown
        const formatted = formatForSpeech(text)
        const clean = stripForSpeech(formatted)
        if (!clean) return

        const utterance = new SpeechSynthesisUtterance(clean)
        utterance.rate = speechRate
        utterance.pitch = speechPitch
        utterance.volume = speechVolume

        // Use selected voice if available
        const selectedVoice = voicesRef.current[selectedVoiceIndex]
        if (selectedVoice) {
            utterance.voice = selectedVoice
        } else if (voicesRef.current.length > 0) {
            utterance.voice = getBestVoice(voicesRef.current)
        }

        utterance.onstart = () => setIsSpeaking(true)
        utterance.onend = () => setIsSpeaking(false)
        utterance.onerror = () => setIsSpeaking(false)

        window.speechSynthesis.speak(utterance)
        setIsSpeaking(true)
    }, [speechRate, speechPitch, speechVolume, selectedVoiceIndex])

    // ── stopSpeaking ──────────────────────────────────────────────────────────
    const stopSpeaking = useCallback(() => {
        window.speechSynthesis?.cancel()
        setIsSpeaking(false)
    }, [])

    return {
        isListening,
        isSpeaking,
        interimText,
        transcript,              // { text, id } — watch this to handle new transcripts
        voiceEnabled,
        setVoiceEnabled,
        availableVoices,         // array of SpeechSynthesisVoice
        selectedVoiceIndex,
        setSelectedVoiceIndex,
        speechRate,              // 0.5 - 2.0
        setSpeechRate,
        speechPitch,             // 0.5 - 2.0
        setSpeechPitch,
        speechVolume,            // 0 - 1
        setSpeechVolume,
        sttSupported,
        ttsSupported,
        startListening,
        stopListening,
        speak,
        stopSpeaking,
    }
}
