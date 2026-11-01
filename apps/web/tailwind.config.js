const primary = '#365314';

export default {
  theme: {
    extend: {
      colors: {
        primary,
        rating: '#EAB308',
        'primary-hover': '#253B0E',
        secondary: '#C2410C',
        soft: '#EEEEE5',
        beige: '#E8DFD1',
        paper: '#FFFBF5',
        surface: '#FFFFFF',
        ink: '#1C1917',
        muted: '#57534E',
        line: '#E7E5E4',
        porcelain: primary,
        brick: '#DC2626',
        sand: '#D4A373',
        forest: primary,
        category: {
          ceramic: '#315C54',
          candle: '#74591E',
          painting: '#994730',
          flower: '#874D58',
          perfume: '#685D78',
          accessory: '#77523B',
          stamp: '#384E79',
          soap: '#476343',
          terrazzo: '#796343',
        },
        'ticket-photo-shade': '#151A18',
        'ticket-stamp': '#9A382C',
        'ticket-warning': '#F5D9CC',
        avatar: {
          moss: '#365314',
          clay: '#8B4635',
          indigo: '#384E79',
          plum: '#685078',
          teal: '#315C54',
        },
        ticket: {
          DEFAULT: '#FAF5E9',
          stub: '#EFE8D8',
          accent: primary,
          line: '#9BAA84',
          ink: '#1C1917',
          skeleton: '#DDD7C9',
        },
      },
      fontFamily: {
        sans: ['Open Sans', 'sans-serif'],
        heading: ['Lora', 'serif'],
        mono: ['Source Code Pro', 'monospace'],
      },
      borderRadius: {
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        full: '9999px',
        ticket: '1rem',
        'ticket-info': '0.5rem',
      },
      spacing: { 'ticket-notch': '0.875rem' },
      maxWidth: { page: '90rem', 'ticket-row': '60rem' },
      keyframes: {
        'home-rise': {
          from: { opacity: '0.3', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'home-photo-drift': {
          from: { transform: 'scale(1)' },
          to: { transform: 'scale(1.06)' },
        },
      },
      animation: {
        'home-rise': 'home-rise 750ms cubic-bezier(.16,1,.3,1) both',
        'home-photo-drift':
          'home-photo-drift 18s ease-in-out infinite alternate',
      },
      boxShadow: {
        overlay: '8px 8px 24px rgb(28 25 23 / 0.1)',
      },
    },
  },
};
