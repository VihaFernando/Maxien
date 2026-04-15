import { useCallback, useState } from 'react'

/**
 * Image that fades in when the browser finishes loading (or errors).
 * While loading, `opacity: 0` is applied inline so final opacity utilities on `className` still apply once loaded.
 */
export function FadeInImg({ src, alt = '', className = '', style, onLoad, onError, ...rest }) {
    const [loadedSrc, setLoadedSrc] = useState('')
    const normalizedSrc = typeof src === 'string' ? src : ''
    const loaded = Boolean(normalizedSrc) && loadedSrc === normalizedSrc

    const handleLoad = useCallback(
        (e) => {
            setLoadedSrc(normalizedSrc)
            onLoad?.(e)
        },
        [normalizedSrc, onLoad]
    )

    const handleError = useCallback(
        (e) => {
            setLoadedSrc(normalizedSrc)
            onError?.(e)
        },
        [normalizedSrc, onError]
    )

    return (
        <img
            src={src}
            alt={alt}
            style={{
                ...style,
                ...(loaded ? {} : { opacity: 0 }),
                transition: 'opacity 0.45s ease-out',
            }}
            onLoad={handleLoad}
            onError={handleError}
            className={className}
            {...rest}
        />
    )
}
