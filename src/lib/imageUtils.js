/**
 * Convert Google Drive share link to direct image URL
 * 
 * IMPORTANT: The Google Drive file MUST be shared with "Anyone with the link" permission!
 * 
 * From: https://drive.google.com/file/d/FILE_ID/view
 * or:   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * To:   https://drive.google.com/uc?export=view&id=FILE_ID&confirm=t
 */
export function convertGoogleDriveLink(url) {
    if (!url) return null

    // Check if it's a Google Drive URL
    if (!url.includes("drive.google.com")) {
        return url
    }

    try {
        // Extract FILE_ID from different Google Drive URL formats
        let fileId = null

        // Format: https://drive.google.com/file/d/FILE_ID/view or /view?usp=sharing
        const match1 = url.match(/\/d\/([a-zA-Z0-9-_]+)/)
        if (match1) {
            fileId = match1[1]
        }

        // Format: https://drive.google.com/open?id=FILE_ID
        if (!fileId) {
            const match2 = url.match(/[?&]id=([a-zA-Z0-9-_]+)/)
            if (match2) {
                fileId = match2[1]
            }
        }

        if (fileId) {
            // Use confirm=t to bypass Google Drive's security check
            const convertedUrl = `https://drive.google.com/uc?export=view&id=${fileId}&confirm=t`
            console.log("🖼️ Google Drive conversion:", {
                original: url,
                converted: convertedUrl,
                fileId,
                timestamp: Date.now()
            })
            return convertedUrl
        }

        console.warn("⚠️ Could not extract file ID from Google Drive URL:", url)
        return url
    } catch (e) {
        console.error("❌ Error converting Google Drive link:", e)
        return url
    }
}
