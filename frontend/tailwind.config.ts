import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		backgroundImage: {
  			'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
  			'conic-gradient': 'conic-gradient(from 0deg, rgba(253, 152, 155, 0.4),rgba(73, 38, 43, 0.2),rgba(62, 144, 241, 0.4), rgba(7, 16, 45, 0.2) ,rgba(137, 112, 241, 0.54),rgba(55, 40, 94, 0.3))'
  		},
  		spacing: {
  			leftNavBarWidth: '52px'
  		},
  		animation: {
  			'spin-slow': 'ColorBlobs_spin 8s linear infinite',
  			fadeInLeft: 'fadeInLeft 1s ease-in-out forwards',
  			float: 'float 2s linear infinite',
  			fadeIn: 'fadeIn 3s ease-in-out forwards',
  			fadeOut: 'fadeOut 1s ease-in-out forwards',
  			fadeIn1s: 'fadeIn 1s ease-in-out',
  			'scroll-bottom-to-top': 'scroll-bottom-to-top 3s ease-in-out forwards',
  			raise: 'raise 1s linear forwards',
  			'spin-slow-seedling': 'fadeIn 1s ease-out, spin 4s linear infinite 1s',
  			'spin-once-seedling': 'spin 4s linear 1'
  		},
  		keyframes: {
  			ColorBlobs_spin: {
  				'0%': {
  					transform: 'translate(-50%, -50%) rotate(0deg) scale(2)'
  				},
  				'100%': {
  					transform: 'translate(-50%, -50%) rotate(1turn) scale(2)'
  				}
  			},
  			float: {
  				'0%': {
  					transform: 'translateY(0)'
  				},
  				'50%': {
  					transform: 'translateY(-100%)'
  				},
  				'1000%': {
  					transform: 'translateY(0)'
  				}
  			},
  			'scroll-bottom-to-top': {
  				'0%': {
  					transform: 'translateY(0)',
  					opacity: '0'
  				},
  				'100%': {
  					transform: 'translateY(-100%)',
  					opacity: '1'
  				}
  			},
  			raise: {
  				'0%': {
  					transform: 'translateY(50%)',
  					opacity: '0'
  				},
  				'100%': {
  					transform: 'translateY(0)',
  					opacity: '1'
  				}
  			},
  			spin: {
  				from: {
  					transform: 'rotate(0deg)'
  				},
  				to: {
  					transform: 'rotate(360deg)'
  				}
  			},
  			fadeIn: {
  				from: {
  					opacity: '0'
  				},
  				to: {
  					opacity: '1'
  				}
  			},
  			fadeInLeft: {
  				'0%': {
  					opacity: '0',
  					transform: 'translateX(-100%)'
  				},
  				'100%': {
  					opacity: '1',
  					transform: 'translateX(0)'
  				}
  			}
  		},
  		boxShadow: {
  			btn: '0px 0px 10px 0px rgba(255, 255, 255, 0.3)'
  		},
  		colors: {
  			error: '#ED1D49FF',
  			textFade: '#93acd3',
  			'white-transparent-80': 'hsla(0, 0%, 100%, .8)',
  			'white-transparent-70': 'hsla(0, 0%, 100%, .7)',
  			'white-transparent-65': 'hsla(0, 0%, 100%, .65)',
  			'white-transparent-60': 'hsla(0, 0%, 100%, .6)',
  			'white-transparent-50': ' hsla(0, 0%, 100%, .5)',
  			'white-transparent-30': 'hsla(0, 0%, 100%, .3)',
  			'background-100': '#0d131c',
  			'background-90': '#111923',
  			'background-80': '#161f2c',
  			'grey-100': '#1c2532',
  			'grey-80': '#202a39',
  			'grey-70': '#263041',
  			'grey-60': '#2a3546',
  			'grey-50': '#3c485c',
  			'grey-40': '#55657e',
  			'grey-30': '#6e81a0',
  			'grey-20': '#93acd3',
  			'dark-shades-gray-100': '#1c2532',
  			'dark-shades-gray-60': '#2a3546',
  			'dark-shades-gray-40': '#55657e',
  			red: '#ed1d49',
  			'red-hover': '#c31d40',
  			'red-pressed': '#ae1435',
  			blue: '#2283f6',
  			'blue-hover': '#0b6ada',
  			'blue-pressed': '#075cc0',
  			yellow: '#ffb636',
  			'yellow-hover': '#ffa200',
  			'yellow-pressed': '#f09000',
  			'yellow-2': '#fed700',
  			green: '#1bb83d',
  			'green-hover': '#1ca63a',
  			'green-pressed': '#1b9636',
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
  		},
  		width: {},
  		screens: {
  			sm: {
  				min: '280px',
  				max: '574px'
  			},
  			md: {
  				min: '575px',
  				max: '915px'
  			},
  			lg: {
  				min: '916px',
  				max: '1199px'
  			},
  			xl: {
  				min: '1200px',
  				max: '4000px'
  			},
  			gmd: {
  				min: '991px'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },

  plugins: [require("tailwindcss-animate")],
};
export default config;
