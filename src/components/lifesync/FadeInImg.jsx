import { useCallback, useEffect, useState } from 'react'

/**
 * Image that fades in when the browser finishes loading (or errors).
 * While loading, `opacity: 0` is applied inline so final opacity utilities on `className` still apply once loaded.
 */
export function FadeInImg({ src, alt = '', className = '', style, onLoad, onError, ...rest }) {
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
        setLoaded(false)
    }, [src])

    const handleLoad = useCallback(
        (e) => {
            setLoaded(true)
            onLoad?.(e)
        },
        [onLoad]
    )

    const handleError = useCallback(
        (e) => {
            setLoaded(true)
            onError?.(e)
        },
        [onError]
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
