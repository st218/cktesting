import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext({})

export const useTheme = () => useContext(ThemeContext)

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') || 'system'
        }
        return 'system'
    })

    useEffect(() => {
        const root = document.documentElement
        if (theme === 'system') {
            root.removeAttribute('data-theme')
        } else {
            root.setAttribute('data-theme', theme)
        }
        localStorage.setItem('theme', theme)
    }, [theme])

    function toggleTheme() {
        setTheme(prev => {
            if (prev === 'light') return 'dark'
            if (prev === 'dark') return 'light'
            // system → check actual preference → toggle to opposite
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            return isDark ? 'light' : 'dark'
        })
    }

    const isDark = theme === 'dark' ||
        (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    return (
        <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}
