
import { withUt } from "uploadthing/tw";
import type { Config } from "tailwindcss"

const config = withUt({
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx,mdx}',
	],
  prefix: "",
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			success: {
  				DEFAULT: 'hsl(var(--success))',
  				foreground: 'hsl(var(--success-foreground))'
  			},
  			warning: {
  				DEFAULT: 'hsl(var(--warning))',
  				foreground: 'hsl(var(--warning-foreground))'
  			},
  			'surface-deep': {
  				DEFAULT: 'hsl(var(--surface-deep))',
  				foreground: 'hsl(var(--surface-deep-foreground))'
  			},
  			akomapa: {
  				teal: {
  					DEFAULT: 'hsl(var(--akomapa-teal))',
  					dark: 'hsl(var(--akomapa-teal-dark))',
  					light: 'hsl(var(--akomapa-teal-light))'
  				},
  				gold: 'hsl(var(--akomapa-gold))',
  				ice: 'hsl(var(--akomapa-ice))',
  				'light-blue': 'hsl(var(--akomapa-light-blue))',
  				cream: 'hsl(var(--akomapa-cream))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-bg))',
  				foreground: 'hsl(var(--sidebar-fg))',
  				muted: 'hsl(var(--sidebar-muted))',
  				accent: 'hsl(var(--sidebar-accent))',
  				border: 'hsl(var(--sidebar-border))',
  				hover: 'hsl(var(--sidebar-hover))',
  				active: 'hsl(var(--sidebar-active))'
  			}
  		},
  		fontFamily: {
  			sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
  			display: ['var(--font-display)', 'Georgia', 'serif']
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		boxShadow: {
  			soft: '0 2px 16px -4px hsl(187 80% 14% / 0.08)',
  			lift: '0 12px 32px -12px hsl(187 80% 14% / 0.18)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'fade-in': {
  				from: { opacity: '0', transform: 'translateY(20px)' },
  				to: { opacity: '1', transform: 'translateY(0)' }
  			},
  			'slide-in': {
  				from: { opacity: '0', transform: 'translateX(-20px)' },
  				to: { opacity: '1', transform: 'translateX(0)' }
  			},
  			'scale-in': {
  				from: { opacity: '0', transform: 'scale(0.95)' },
  				to: { opacity: '1', transform: 'scale(1)' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'fade-in': 'fade-in 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards',
  			'slide-in': 'slide-in 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards',
  			'scale-in': 'scale-in 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}) satisfies Config

export default config