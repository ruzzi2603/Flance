import { useEffect, useState } from "react";
import "./globals.css";

export default function Splash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      document.body.style.overflow = "auto"; // libera scroll
    }, 3000); // tempo da animação

    return () => clearTimeout(timer);
  }, []);

  return (
    <div id="splash" className={visible ? "show" : "hide"}>
      <div className="logo-container">
        <svg viewBox="0 0 1200 180" className="logo-svg">
          <defs>
            <linearGradient id="grad" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#7a3cff" />
              <stop offset="50%" stopColor="#007cff" />
              <stop offset="100%" stopColor="#00d4ff" />
              <animateTransform
                attributeName="gradientTransform"
                type="translate"
                values="-200 0;200 0;-200 0"
                dur="6s"
                repeatCount="indefinite"
              />
            </linearGradient>
          </defs>

          {/* FLANCE */}
          <path className="letter f" d="M40 40 V140 M40 40 H100 M40 90 H80" />
          <path className="letter l" d="M140 40 V140 H180" />
          <path className="letter a" d="M220 140 L250 40 L280 140 M232 95 H268" />
          <path className="letter n" d="M320 140 V40 L380 140 V40" />
          <path
            className="letter c"
            d="M440 100 Q440 40 480 40 H500 M440 90 Q440 140 480 140 H500"
          />
          <path className="letter e" d="M540 40 V140 H600 M540 40 H600 M540 90 H580 M540 140 H600" />
        </svg>
      </div>
    </div>
  );
}
