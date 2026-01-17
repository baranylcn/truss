# GroveML

> Machine Learning Made Simple - No Code Required

GroveML is a modern, intuitive machine learning platform that enables anyone to build, train, and deploy ML models without writing a single line of code. Built with React, TypeScript, and Supabase.

## Features

- **No Code Required** - Visual ML pipeline builder with drag-and-drop interface
- **Lightning Fast** - Optimized performance with instant feedback
- **Production Ready** - Enterprise-grade ML models in minutes
- **Multi-Language Support** - English and Turkish localization
- **Client-Side Processing** - Process data locally without server dependencies
- **Backend Integration** - Optional API backend for advanced features
- **Session Persistence** - Auto-save your work with localStorage
- **Interactive Data Analysis** - Real-time data exploration and visualization
- **Automated ML Pipeline** - Complete workflow from data upload to model deployment

### ML Features

- CSV data upload and parsing
- Automated data analysis and profiling
- Missing value detection and handling
- Outlier detection and treatment
- Feature encoding (Label, One-Hot, Ordinal)
- Feature scaling (Standard, MinMax, Robust)
- Correlation analysis with heatmaps
- Model training (Linear Regression, Random Forest, etc.)
- Model evaluation and performance metrics
- Hyperparameter optimization

## Tech Stack

### Frontend
- **React 18.3** - Modern UI library
- **TypeScript 5.5** - Type-safe development
- **Vite 5.4** - Lightning-fast build tool
- **Tailwind CSS 3.4** - Utility-first styling
- **Framer Motion 12** - Smooth animations
- **Recharts 3.6** - Data visualization
- **React Dropzone 14** - File upload handling
- **React Hot Toast 2** - Beautiful notifications
- **Lucide React** - Modern icon library

### Backend
- **Supabase** - Database and authentication
- **PostgreSQL** - Relational database
- **Row Level Security** - Data protection

### Development Tools
- **ESLint 9** - Code linting
- **PostCSS** - CSS processing
- **Autoprefixer** - CSS vendor prefixes

## Project Structure

```
├── public/                      # Static assets
│   ├── groveml_logo.png        # Main logo
│   ├── groveml_logo_sekme.png  # Favicon
│   └── happyml_logo2.png       # Alternative logo
│
├── src/
│   ├── components/             # React components
│   │   ├── steps/              # ML pipeline step components
│   │   │   ├── AnalysisStep.tsx
│   │   │   ├── CorrelationStep.tsx
│   │   │   ├── EncodingStep.tsx
│   │   │   ├── EvaluationStep.tsx
│   │   │   ├── MissingValuesStep.tsx
│   │   │   ├── OptimizationStep.tsx
│   │   │   ├── OutlierHandlingStep.tsx
│   │   │   ├── ScalingStep.tsx
│   │   │   └── TrainingStep.tsx
│   │   ├── DataTable.tsx       # Data grid component
│   │   ├── FileUpload.tsx      # CSV upload component
│   │   ├── InfoTip.tsx         # Tooltip helper
│   │   ├── LanguageSelector.tsx # Language switcher
│   │   ├── Logo.tsx            # Logo component
│   │   ├── MLPipeline.tsx      # Main pipeline orchestrator
│   │   ├── NeuralNetwork.tsx   # Background animation
│   │   ├── StepIndicator.tsx   # Progress tracker
│   │   ├── Tooltip.tsx         # Reusable tooltip
│   │   └── WelcomePage.tsx     # Landing page
│   │
│   ├── config/                 # Configuration files
│   │   └── api.ts              # API configuration
│   │
│   ├── constants/              # App constants
│   │   └── index.ts            # Shared constants
│   │
│   ├── hooks/                  # Custom React hooks
│   │   └── useLanguage.ts      # Language management
│   │
│   ├── lib/                    # External library configs
│   │   └── supabase.ts         # Supabase client
│   │
│   ├── services/               # Business logic
│   │   ├── api.ts              # API service layer
│   │   └── localDataProcessor.ts # Client-side processing
│   │
│   ├── types/                  # TypeScript types
│   │   └── index.ts            # Type definitions
│   │
│   ├── utils/                  # Utility functions
│   │   ├── apiClient.ts        # HTTP client
│   │   └── csvParser.ts        # CSV parsing
│   │
│   ├── App.tsx                 # Root component
│   ├── main.tsx                # App entry point
│   └── index.css               # Global styles
│
├── .env.example                # Environment template
├── vercel.json                 # Vercel configuration
├── vite.config.ts              # Vite configuration
├── tailwind.config.js          # Tailwind configuration
├── tsconfig.json               # TypeScript configuration
└── package.json                # Dependencies

```

## Prerequisites

- **Node.js** 18+ and npm/yarn
- **Git** for version control
- **Supabase Account** (database is pre-configured)

## Installation

### 1. Clone the Repository

```bash
git clone grovemlplatform-frontend
cd groveml
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Supabase Configuration (Required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Backend Configuration (Optional)
VITE_USE_BACKEND=false           # Set to true if using backend API
VITE_API_BASE_URL=/api           # Backend API URL

# Feature Flags (Optional)
VITE_ENABLE_AUTH=false           # Enable authentication features
VITE_ENABLE_ANALYTICS=false      # Enable analytics tracking
```

### 4. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint

# Type checking
npm run typecheck
```

### Code Quality

The project uses ESLint for code quality. Run linting before committing:

```bash
npm run lint
```

### Type Checking

TypeScript strict mode is enabled. Verify types:

```bash
npm run typecheck
```

## Testing

### Manual Testing Checklist

#### Basic Functionality
- [ ] Welcome page loads correctly
- [ ] Language switching works (EN/TR)
- [ ] "Get Started" button navigates to pipeline
- [ ] Session persists on page refresh

#### File Upload
- [ ] CSV file can be uploaded
- [ ] Valid CSV files are accepted
- [ ] Invalid files show error message
- [ ] Large files (>10MB) are handled

#### Data Analysis
- [ ] Data preview shows correct columns
- [ ] Statistics are calculated correctly
- [ ] Missing values are detected
- [ ] Data types are identified

#### ML Pipeline Steps
- [ ] Missing values can be handled
- [ ] Outliers can be detected
- [ ] Encoding methods work
- [ ] Scaling methods work
- [ ] Correlation heatmap displays
- [ ] Model training completes
- [ ] Evaluation metrics show

#### UI/UX
- [ ] Animations are smooth
- [ ] Tooltips display correctly
- [ ] Responsive design on mobile
- [ ] Dark theme looks good
- [ ] Loading states work

### Browser Testing

Test on:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

### Performance Testing

```bash
# Build and analyze bundle size
npm run build

# Expected bundle size: ~1MB (312KB gzipped)
```

## Build

### Production Build

```bash
npm run build
```

Build output will be in the `dist/` directory:
- `dist/index.html` - Entry HTML
- `dist/assets/` - Compiled JS/CSS bundles

### Build Verification

After building, preview the production build:

```bash
npm run preview
```

### Build Optimization

Current bundle size: **1.04 MB** (312 KB gzipped)

To optimize further:
1. Enable code splitting for large dependencies
2. Lazy load route components
3. Optimize images and assets
4. Enable compression on hosting

## Deployment

### Vercel (Recommended)

#### Method 1: GitHub Integration

1. Push code to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

2. Visit [Vercel Dashboard](https://vercel.com)

3. Click "Import Project"

4. Select your GitHub repository

5. Configure environment variables:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_USE_BACKEND=false
VITE_API_BASE_URL=/api
```

6. Click "Deploy"

#### Method 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

The CLI will prompt for environment variables.

### Netlify

1. Push code to GitHub

2. Visit [Netlify Dashboard](https://app.netlify.com)

3. Click "New site from Git"

4. Select repository

5. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`

6. Add environment variables in site settings

7. Deploy

### Docker

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build and run:

```bash
docker build -t groveml .
docker run -p 80:80 groveml
```

### Environment-Specific Configuration

#### Development
```env
VITE_USE_BACKEND=false
VITE_API_BASE_URL=http://localhost:3000/api
```

#### Staging
```env
VITE_USE_BACKEND=true
VITE_API_BASE_URL=https://staging-api.yourapp.com/api
```

#### Production
```env
VITE_USE_BACKEND=true
VITE_API_BASE_URL=https://api.yourapp.com/api
```

## Configuration

### Supabase Setup

The project uses Supabase for data persistence. The database is pre-configured with:

- Authentication (optional)
- Row Level Security (RLS)
- Real-time subscriptions (optional)

To connect your own Supabase instance:

1. Create a project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key
3. Update `.env` with your credentials
4. Run database migrations (if any)

### API Configuration

Edit `src/config/api.ts` to customize API behavior:

```typescript
export const API_CONFIG = {
  useBackend: import.meta.env.VITE_USE_BACKEND === 'true',
  baseUrl: import.meta.env.VITE_API_BASE_URL,
  timeout: 30000,
  retries: 3,
};
```

### Language Configuration

Add new languages in `src/hooks/useLanguage.ts`:

```typescript
const translations = {
  en: { /* English translations */ },
  tr: { /* Turkish translations */ },
  // Add more languages here
};
```

## Usage

### Basic Workflow

1. **Upload Data**: Drag and drop a CSV file or click to browse
2. **Analyze Data**: Review statistics and data quality
3. **Handle Missing Values**: Choose imputation strategy
4. **Detect Outliers**: Identify and handle anomalies
5. **Encode Features**: Convert categorical variables
6. **Scale Features**: Normalize numerical data
7. **Analyze Correlations**: Review feature relationships
8. **Train Model**: Select algorithm and train
9. **Evaluate Results**: Review performance metrics
10. **Optimize Model**: Fine-tune hyperparameters

### Data Requirements

Your CSV file should:
- Have a header row with column names
- Contain at least 10 rows of data
- Include both features and target variable
- Use comma (,) as delimiter
- Be under 50MB in size

Example CSV structure:
```csv
feature1,feature2,feature3,target
1.2,red,10,yes
3.4,blue,20,no
5.6,red,30,yes
```

### Client-Side vs Backend Mode

#### Client-Side Mode (Default)
- All processing happens in browser
- No server required
- Data never leaves user's device
- Limited to smaller datasets (<10MB)
- Faster for small data

#### Backend Mode
- Processing on server
- Can handle larger datasets
- Requires backend API
- More ML algorithms available
- Better for production use

Toggle in `.env`:
```env
VITE_USE_BACKEND=true
```

## Troubleshooting

### Common Issues

#### Build Fails
```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

#### Environment Variables Not Working
- Ensure variables start with `VITE_`
- Restart dev server after changing `.env`
- Check `.env` file is in project root

#### Supabase Connection Error
- Verify `VITE_SUPABASE_URL` is correct
- Check `VITE_SUPABASE_ANON_KEY` is valid
- Ensure Supabase project is active
- Check browser console for errors

#### CSV Upload Fails
- Verify file is valid CSV format
- Check file size (<50MB)
- Ensure proper encoding (UTF-8)
- Review browser console for errors

#### Session Not Persisting
- Check browser localStorage is enabled
- Clear localStorage: `localStorage.clear()`
- Try incognito/private mode
- Check browser console for errors

### Debug Mode

Enable verbose logging:

```typescript
// Add to src/main.tsx
if (import.meta.env.DEV) {
  console.log('Debug mode enabled');
  window.DEBUG = true;
}
```

## Performance

### Optimization Tips

1. **Code Splitting**: Lazy load components
2. **Image Optimization**: Use WebP format
3. **Bundle Analysis**: Use `rollup-plugin-visualizer`
4. **Caching**: Enable service workers
5. **CDN**: Serve static assets from CDN

### Current Metrics

- **Bundle Size**: 1.04 MB (312 KB gzipped)
- **First Load**: ~2s on 3G
- **Time to Interactive**: ~3s on 3G
- **Lighthouse Score**: 90+ (Performance)

## Security

### Best Practices

- Never commit `.env` file
- Use environment variables for secrets
- Enable RLS on Supabase tables
- Validate all user inputs
- Sanitize file uploads
- Use HTTPS in production
- Implement rate limiting
- Enable CORS properly

### Supabase Security

Row Level Security is enabled. Users can only access their own data.

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Opera 76+

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

For issues and questions:
- Open an issue on GitHub
- Email: support@groveml.com
- Documentation: https://docs.groveml.com

## Roadmap

- [ ] More ML algorithms (SVM, Neural Networks)
- [ ] Model export/import functionality
- [ ] Collaborative features
- [ ] API integration marketplace
- [ ] Real-time collaboration
- [ ] Mobile app (React Native)
- [ ] Advanced visualizations
- [ ] AutoML capabilities

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and type checking
6. Submit a pull request

## Acknowledgments

- Built with React and TypeScript
- Powered by Supabase
- Icons by Lucide
- Animations by Framer Motion
- Charts by Recharts
