const BASE_URL = 'https://www.googleapis.com/calendar/v3'

/**
 * Fetch events from primary Google Calendar within a time range.
 */
export async function fetchGoogleEvents(token, timeMin, timeMax) {
    const params = new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '500',
    })

    const res = await fetch(`${BASE_URL}/calendars/primary/events?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message || `Google Calendar API error ${res.status}`)
    }

    const data = await res.json()
    return data.items || []
}

/**
 * Create a new event. Pass conferenceDataVersion=1 to support Google Meet links.
 */
export async function createGoogleEvent(token, eventData) {
    const res = await fetch(
        `${BASE_URL}/calendars/primary/events?conferenceDataVersion=1`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventData),
        }
    )

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message || `Failed to create event (${res.status})`)
    }

    return res.json()
}

/**
 * Partially update an existing event (PATCH).
 */
export async function updateGoogleEvent(token, eventId, eventData) {
    const res = await fetch(
        `${BASE_URL}/calendars/primary/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1`,
        {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventData),
        }
    )

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message || `Failed to update event (${res.status})`)
    }

    return res.json()
}

/**
 * Delete an event by ID.
 */
export async function deleteGoogleEvent(token, eventId) {
    const res = await fetch(
        `${BASE_URL}/calendars/primary/events/${encodeURIComponent(eventId)}`,
        {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        }
    )

    if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message || `Failed to delete event (${res.status})`)
    }
}
