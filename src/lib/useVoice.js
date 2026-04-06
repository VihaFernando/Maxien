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
        .replace(/^[•*-]\s/gm, ". ")            // bullets → periods (pauses)
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
        v => /British|UK/i.test(v.name),  // Mac fallback
        v => /English Female|Emma|Victoria/i.test(v.name),  // Mac system voices
        v => v.lang.startsWith("en"),  // Last resort: any English voice
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
    const [selectedVoiceName, setSelectedVoiceName] = useState(() => {
        try { return localStorage.getItem("maxien_voice_name") || "" } catch { return "" }
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
        try { localStorage.setItem("maxien_voice_enabled", String(voiceEnabled)) } catch { void 0 }
    }, [voiceEnabled])
    useEffect(() => {
        try { localStorage.setItem("maxien_voice_index", String(selectedVoiceIndex)) } catch { void 0 }
    }, [selectedVoiceIndex])
    useEffect(() => {
        try { localStorage.setItem("maxien_voice_name", String(selectedVoiceName)) } catch { void 0 }
    }, [selectedVoiceName])
    useEffect(() => {
        try { localStorage.setItem("maxien_speech_rate", String(speechRate)) } catch { void 0 }
    }, [speechRate])
    useEffect(() => {
        try { localStorage.setItem("maxien_speech_pitch", String(speechPitch)) } catch { void 0 }
    }, [speechPitch])
    useEffect(() => {
        try { localStorage.setItem("maxien_speech_volume", String(speechVolume)) } catch { void 0 }
    }, [speechVolume])

    // Load TTS voices (Chrome requires waiting for voiceschanged event)
    useEffect(() => {
        if (!window.speechSynthesis) return
        const load = () => {
            const voices = window.speechSynthesis.getVoices()
            // Try Google voices first (Chrome), fall back to all English voices
            let filteredVoices = voices.filter(v => v.lang.startsWith("en") && /Google/i.test(v.name))
            if (filteredVoices.length === 0) {
                // Mac/Safari fallback: use all English voices
                filteredVoices = voices.filter(v => v.lang.startsWith("en"))
            }
            voicesRef.current = filteredVoices
            setAvailableVoices(filteredVoices)

            // Set UK English Female as default if no voice preference is saved
            // But fall back to best available voice if UK Female isn't available (Mac)
            if (!localStorage.getItem("maxien_voice_name")) {
                const ukFemaleIndex = filteredVoices.findIndex(v => /Google UK English Female|British/i.test(v.name))
                if (ukFemaleIndex !== -1) {
                    setSelectedVoiceIndex(ukFemaleIndex)
                    setSelectedVoiceName(filteredVoices[ukFemaleIndex].name)
                } else if (filteredVoices.length > 0) {
                    // Mac fallback: pick the first available voice
                    setSelectedVoiceIndex(0)
                    setSelectedVoiceName(filteredVoices[0].name)
                }
            }
        }
        load()
        window.speechSynthesis.addEventListener("voiceschanged", load)
        return () => window.speechSynthesis.removeEventListener("voiceschanged", load)
    }, [])

    // Sync voice name when index changes (to persist the specific voice selected)
    useEffect(() => {
        const voice = voicesRef.current[selectedVoiceIndex]
        if (voice) {
            setSelectedVoiceName(voice.name)
        }
    }, [selectedVoiceIndex])

    // If the saved voice name isn't in the current list (e.g. on mobile/desktop)
    // pick the best available voice and update the selection. This ensures
    // we don't silently drift to a random voice when the chosen one disappears.
    useEffect(() => {
        if (!selectedVoiceName) return
        const idx = voicesRef.current.findIndex(v => v.name === selectedVoiceName)
        if (idx === -1 && voicesRef.current.length > 0) {
            const best = getBestVoice(voicesRef.current)
            const bestIndex = voicesRef.current.indexOf(best)
            setSelectedVoiceIndex(bestIndex)
            setSelectedVoiceName(best.name)
        }
    }, [availableVoices, selectedVoiceName])

    useEffect(() => {
        return () => {
            try {
                window.speechSynthesis?.cancel()
            } catch {
                void 0
            }
        }
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
            try { recognition.stop() } catch { void 0 }
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
            try { recognition.abort() } catch { void 0 }
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
        try { recognitionRef.current?.stop() } catch { void 0 }
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

        // Try to find voice by name first (survives voice re-filtering)
        let selectedVoice = null
        if (selectedVoiceName) {
            selectedVoice = voicesRef.current.find(v => v.name === selectedVoiceName)
        }
        // Fall back to index if name not found
        if (!selectedVoice) {
            selectedVoice = voicesRef.current[selectedVoiceIndex]
        }
        // Fall back to best voice if still not found
        if (!selectedVoice && voicesRef.current.length > 0) {
            selectedVoice = getBestVoice(voicesRef.current)
        }

        if (selectedVoice) {
            utterance.voice = selectedVoice
        }

        utterance.onstart = () => setIsSpeaking(true)
        utterance.onend = () => setIsSpeaking(false)
        utterance.onerror = () => setIsSpeaking(false)

        window.speechSynthesis.speak(utterance)
        setIsSpeaking(true)
    }, [speechRate, speechPitch, speechVolume, selectedVoiceIndex, selectedVoiceName])

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
