import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "danger" | "ghost";
    size?: "sm" | "md" | "lg";
    fullWidth?: boolean;
}

export default function Button({
    variant = "primary",
    size = "md",
    fullWidth = false,
    className = "",
    children,
    ...rest
}: ButtonProps) {
    return (
        <button
            className={[
                styles.btn,
                styles[variant],
                styles[size],
                fullWidth ? styles.full : "",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
            {...rest}
        >
            {children}
        </button>
    );
}
