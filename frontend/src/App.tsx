import { useState } from 'react'
import { useAuth } from './contexts/AuthContext'
import LandingPage from './pages/LandingPage'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import CreateProjectModal from './components/CreateProjectModal'
import Footer from './components/Footer'
import UploadPage from './pages/UploadPage'
import AnalyzePage from './pages/AnalyzePage'
import MissingValuesPage from './pages/MissingValuesPage'
import OutliersPage from './pages/OutliersPage'
import EncodingPage from './pages/EncodingPage'
import CorrelationPage from './pages/CorrelationPage'
import ScalingPage from './pages/ScalingPage'
import TrainingPage from './pages/TrainingPage'
import EvaluationPage from './pages/EvaluationPage'
import OptimizationPage from './pages/OptimizationPage'
import ExportPage from './pages/ExportPage'
import SettingsPage from './pages/SettingsPage'
import DashboardPage from './pages/DashboardPage'
import ProjectsPage from './pages/ProjectsPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import FreestyleLayout from './freestyle/FreestyleLayout'
import { projectsApi } from './services/api/projects'
import type { AppPage, PipelineStep, ViewMode } from './types'

const STEP_TITLES: Record<PipelineStep, string> = {
  upload: 'Upload Dataset',
  analyze: 'Dataset Analysis',
  'missing-values': 'Missing Values',
  outliers: 'Outliers Detection',
  encoding: 'Feature Encoding',
  correlation: 'Feature Correlation',
  scaling: 'Feature Scaling',
  training: 'Model Training',
  evaluation: 'Model Evaluation',
  optimization: 'Hyperparameter Optimization',
  export: 'Export & Results',
  'filter-rows': 'Filter Rows',
  'feature-engineering': 'Feature Engineering',
  'feature-selection': 'Feature Selection',
  'cross-validate': 'Cross Validation',
  'pipeline-history': 'Pipeline History',
}

const FREESTYLE_ONLY_STEPS = new Set<PipelineStep>([
  'filter-rows', 'feature-engineering', 'feature-selection', 'cross-validate', 'pipeline-history',
])

const STEP_BADGES: Partial<Record<PipelineStep, string>> = {}

export default function App() {
  const { user, loading } = useAuth()
  const [currentPage, setCurrentPage] = useState<AppPage>('dashboard')
  const [currentStep, setCurrentStep] = useState<PipelineStep>('upload')
  const [viewMode, setViewMode] = useState<ViewMode>('guided')
  const [authPage, setAuthPage] = useState<'landing' | 'login' | 'register' | 'reset'>('landing')
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [showCreateProject, setShowCreateProject] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-[#f97316] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#64748b]">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    if (authPage === 'landing') {
      return <LandingPage onNavigate={setAuthPage} />
    }
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex flex-col overflow-y-auto">
        {authPage === 'login' && <LoginPage onNavigate={setAuthPage} />}
        {authPage === 'register' && <RegisterPage onNavigate={setAuthPage} />}
        {authPage === 'reset' && <ResetPasswordPage onNavigate={setAuthPage} />}
      </div>
    )
  }

  // Fire-and-forget DB writes — UI never waits for these
  const persistStep = (projectId: string, step: PipelineStep) => {
    projectsApi.update(projectId, { current_step: step }).catch(() => {})
  }

  const persistViewMode = (projectId: string, mode: ViewMode) => {
    projectsApi.update(projectId, { view_mode: mode }).catch(() => {})
  }

  const handlePageChange = (page: AppPage) => {
    setCurrentPage(page)
  }

  const handleStepChange = (step: PipelineStep) => {
    setCurrentStep(step)
    setCurrentPage('pipeline')
    if (activeProjectId) persistStep(activeProjectId, step)
  }

  // Called when opening a project from dashboard/projects list — reads mode/step from project data
  const handleOpenProject = (projectId: string, step: PipelineStep, mode: ViewMode) => {
    setActiveProjectId(projectId)
    setCurrentStep(step)
    setViewMode(mode)
    setCurrentPage('pipeline')
  }

  const handleNext = (step: PipelineStep) => {
    setCurrentStep(step)
    if (activeProjectId) persistStep(activeProjectId, step)
  }

  // Switch view mode mid-session and persist.
  // When switching to guided while on a freestyle-only step, fall back to missing-values.
  const handleSwitchViewMode = (mode: ViewMode) => {
    setViewMode(mode)
    if (mode === 'guided' && FREESTYLE_ONLY_STEPS.has(currentStep)) {
      setCurrentStep('missing-values')
      if (activeProjectId) persistStep(activeProjectId, 'missing-values')
    }
    if (activeProjectId) persistViewMode(activeProjectId, mode)
  }

  const getPageTitle = (): string => {
    if (currentPage === 'dashboard') return 'Dashboard'
    if (currentPage === 'settings') return 'Settings'
    if (currentPage === 'projects') return 'Projects'
    return STEP_TITLES[currentStep]
  }

  const getPageBadge = (): string | undefined => {
    if (currentPage === 'pipeline') return STEP_BADGES[currentStep]
    return undefined
  }

  const renderContent = () => {
    if (currentPage === 'dashboard') {
      return (
        <DashboardPage
          onPageChange={handlePageChange}
          onStepChange={handleStepChange}
          onOpenProject={handleOpenProject}
          onNewProject={() => setShowCreateProject(true)}
        />
      )
    }
    if (currentPage === 'settings') {
      return <SettingsPage />
    }
    if (currentPage === 'projects') {
      return <ProjectsPage onOpenProject={handleOpenProject} />
    }
    const projectId = activeProjectId ?? ''
    switch (currentStep) {
      case 'upload': return <UploadPage projectId={projectId} onNext={handleNext} />
      case 'analyze': return <AnalyzePage projectId={projectId} onNext={handleNext} />
      case 'missing-values': return <MissingValuesPage projectId={projectId} onNext={handleNext} />
      case 'outliers': return <OutliersPage projectId={projectId} onNext={handleNext} />
      case 'encoding': return <EncodingPage projectId={projectId} onNext={handleNext} />
      case 'correlation': return <CorrelationPage projectId={projectId} onNext={handleNext} />
      case 'scaling': return <ScalingPage projectId={projectId} onNext={handleNext} />
      case 'training': return <TrainingPage projectId={projectId} onNext={handleNext} />
      case 'evaluation': return <EvaluationPage projectId={projectId} onNext={handleNext} />
      case 'optimization': return <OptimizationPage projectId={projectId} onNext={handleNext} />
      case 'export': return <ExportPage projectId={projectId} onDashboard={() => handlePageChange('dashboard')} />
      default:
        // Freestyle-only steps have no guided equivalent — redirect to missing-values
        return <MissingValuesPage projectId={projectId} onNext={handleNext} />
    }
  }

  // Freestyle mode: full-screen layout, no sidebar
  if (currentPage === 'pipeline' && viewMode === 'freestyle') {
    return (
      <>
        <FreestyleLayout
          projectId={activeProjectId ?? ''}
          currentStep={currentStep}
          onStepChange={(step) => {
            setCurrentStep(step)
            if (activeProjectId) persistStep(activeProjectId, step)
          }}
          onPageChange={(page) => {
            // Navigate away without changing view_mode in DB.
            // When the user returns to this project it will correctly reopen in freestyle.
            handlePageChange(page)
          }}
          onSwitchToGuided={() => handleSwitchViewMode('guided')}
          onNewProject={() => setShowCreateProject(true)}
        />
        {showCreateProject && (
          <CreateProjectModal
            onClose={() => setShowCreateProject(false)}
            onCreated={(id, mode) => {
              setShowCreateProject(false)
              handleOpenProject(id, 'upload', mode)
              if (mode !== 'guided') persistViewMode(id, mode)
            }}
          />
        )}
      </>
    )
  }

  return (
    <div className="bg-[#0d1117]" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        currentPage={currentPage}
        currentStep={currentStep}
        onPageChange={handlePageChange}
        onStepChange={handleStepChange}
        onBackToDashboard={() => handlePageChange('dashboard')}
        viewMode={viewMode}
        onSwitchToFreestyle={() => handleSwitchViewMode('freestyle')}
      />
      <div className="flex flex-col" style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
        <TopBar
          title={getPageTitle()}
          badge={getPageBadge()}
          onNewProject={() => setShowCreateProject(true)}
        />
        <main style={{ flex: 1, height: '100%', overflowY: 'auto', minWidth: 0 }}>
          {renderContent()}
        </main>
        <Footer />
      </div>
      {showCreateProject && (
        <CreateProjectModal
          onClose={() => setShowCreateProject(false)}
          onCreated={(id, mode) => {
            setShowCreateProject(false)
            handleOpenProject(id, 'upload', mode)
            if (mode !== 'guided') persistViewMode(id, mode)
          }}
        />
      )}
    </div>
  )
}
