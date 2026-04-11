export default {
    darkMode: ["class"],
    content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}", // ← make sure this line is included
  ],
  theme: {
  	extend: {
  		screens: {
  			'xs': '375px',         // Extra small / Mobile M
  			'sm-mobile': '320px',  // Mobile S
  			'md-mobile': '375px',  // Mobile M
  			'lg-mobile': '425px',  // Mobile L
  			'tablet': '765px',     // Tablet
  		},
  		fonts: {
  			'headline': ['Manrope', 'sans-serif'],
  			'body': ['Inter', 'sans-serif'],
  			'label': ['Inter', 'sans-serif'],
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			// Material Design 3 Colors
  			'on-secondary-fixed-variant': '#584400',
  			'on-tertiary-fixed-variant': '#821c53',
  			'on-background': '#1b1b1b',
  			'error-container': '#ffdad6',
  			'secondary-fixed-dim': '#f3c000',
  			'primary-fixed-dim': '#87da73',
  			'outline-variant': '#c0cab8',
  			'on-primary-container': '#94e87f',
  			'surface-bright': '#f9f9f9',
  			'surface-container-lowest': '#ffffff',
  			'primary-fixed': '#a2f78c',
  			'background': '#f9f9f9',
  			'inverse-surface': '#303030',
  			'secondary-container': '#fcc810',
  			'on-primary': '#ffffff',
  			'secondary': '#755b00',
  			'surface-container-highest': '#e2e2e2',
  			'on-surface': '#1b1b1b',
  			'tertiary-container': '#9d3368',
  			'on-error-container': '#93000a',
  			'on-tertiary-fixed': '#3d0023',
  			'on-surface-variant': '#40493c',
  			'surface-container-high': '#e8e8e8',
  			'on-primary-fixed-variant': '#015300',
  			'on-secondary': '#ffffff',
  			'on-tertiary': '#ffffff',
  			'surface-variant': '#e2e2e2',
  			'primary-container': '#176a0f',
  			'tertiary': '#7f1950',
  			'on-secondary-container': '#6d5500',
  			'on-tertiary-container': '#ffc4d9',
  			'inverse-on-surface': '#f1f1f1',
  			'error': '#ba1a1a',
  			'secondary-fixed': '#ffdf90',
  			'primary': '#015000',
  			'surface': '#f9f9f9',
  			'outline': '#707a6a',
  			'on-secondary-fixed': '#241a00',
  			'surface-tint': '#1b6d12',
  			'tertiary-fixed-dim': '#ffb0cf',
  			'surface-dim': '#dadada',
  			'on-primary-fixed': '#002200',
  			'inverse-primary': '#87da73',
  			'on-error': '#ffffff',
  			'tertiary-fixed': '#ffd9e5',
  			'surface-container': '#eeeeee',
  			'surface-container-low': '#f3f3f3',
  			
  			// Dark mode custom colors
  			'dark-bg': '#171717',
  			'dark-surface': '#1f1f1f',
  			'dark-border': '#2a2a2a',
  			'dark-text': '#ffffff',
  			'dark-text-secondary': '#e5e5e5',
  			'dark-text-muted': '#a3a3a3',
  			
  			// Keep existing colors for backward compatibility
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
