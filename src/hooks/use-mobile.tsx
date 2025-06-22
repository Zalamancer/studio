import * as React from "react"

const MOBILE_BREAKPOINT = 768 // Reverted from 1024

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    // This effect runs only on the client side, after initial hydration.
    const checkDevice = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }

    checkDevice() // Check on mount

    window.addEventListener("resize", checkDevice)
    return () => window.removeEventListener("resize", checkDevice)
  }, []) // Empty dependency array ensures this runs once on mount

  return isMobile
}
