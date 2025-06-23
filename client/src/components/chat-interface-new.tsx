import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Loader2, Send, Code, FileText, Zap, AlertCircle, CheckCircle, Info, X, Save, MessageSquare } from 'lucide-react';
import TypingAnimation from '@/components/ui/typing-animation';
import LoadingAnimation from '@/components/ui/loading-animation';
import CodeStream from '@/components/ui/code-stream';
import { Project } from '@/lib/file-system';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { Eye } from 'lucide-react';

// Enhanced Types and Interfaces
interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  timestamp: Date;
  type?: 'analysis' | 'code' | 'normal' | 'error' | 'system';
  metadata?: {
    filesGenerated?: string[];
    language?: string;
    stage?: string;
    complexity?: 'basic' | 'intermediate' | 'advanced' | 'enterprise';
    patterns?: string[];
    technologies?: string[];
    estimatedLines?: number;
  };
}

interface ChatInterfaceProps {
  project: Project;
  onConsoleLog: (message: string, type?: 'success' | 'error' | 'info') => void;
  onAppUpdate?: (htmlContent: string) => void;
  onFileGenerated?: (fileName: string, content: string, language: string) => void;
}

interface GenerationStage {
  id: string;
  name: string;
  description: string;
  progress: number;
  estimatedTime: number;
}

interface LiveCodingState {
  fileName: string;
  content: string;
  isActive: boolean;
  language: string;
  progress: number;
  complexity: string;
  patterns: string[];
}

interface APIResponse {
  response: string;
  success: boolean;
  error?: string;
  metadata?: {
    complexity?: string;
    patterns?: string[];
    technologies?: string[];
    estimatedLines?: number;
    architecture?: string;
  };
}

interface CancelToken {
  cancelled: boolean;
  cancel: () => void;
}

// Enhanced Constants with Advanced Code Generation Prompts
const ADVANCED_CODE_GENERATION_PROMPT = `
Generate production-ready, enterprise-level code with the following requirements:

ARCHITECTURE & PATTERNS:
- Clean Architecture with separation of concerns
- SOLID principles implementation
- Design patterns (Factory, Observer, Strategy, etc.)
- Dependency injection where applicable
- Error handling and logging
- Input validation and sanitization
- Security best practices
- Performance optimization
- Responsive design for web applications
- Accessibility compliance (WCAG 2.1)

TECHNOLOGY STACK:
- Modern JavaScript/TypeScript with ES6+ features
- React with hooks and modern patterns
- Node.js with Express for backend
- CSS3 with Flexbox/Grid
- HTML5 semantic markup
- Database integration (SQL/NoSQL)
- API design (RESTful/GraphQL)
- Authentication and authorization
- Testing frameworks (Jest, Cypress)
- Build tools and bundlers

CODE QUALITY:
- Comprehensive documentation
- Type safety and interfaces
- Unit and integration tests
- Code linting and formatting
- Performance monitoring
- Error boundaries and fallbacks
- Loading states and skeletons
- Progressive enhancement
- Cross-browser compatibility
- Mobile-first approach

Generate complete, working applications with multiple files, proper structure, and professional-grade implementation.
`;

const GENERATION_STAGES: GenerationStage[] = [
  { id: 'analysis', name: 'Analyzing Requirements', description: 'Understanding project scope and complexity', progress: 0, estimatedTime: 2 },
  { id: 'architecture', name: 'Designing Architecture', description: 'Creating system design and patterns', progress: 15, estimatedTime: 3 },
  { id: 'structure', name: 'Setting Up Structure', description: 'Creating file structure and configurations', progress: 30, estimatedTime: 2 },
  { id: 'frontend', name: 'Building Frontend', description: 'Generating UI components and styles', progress: 45, estimatedTime: 8 },
  { id: 'backend', name: 'Creating Backend', description: 'Implementing server logic and APIs', progress: 70, estimatedTime: 6 },
  { id: 'integration', name: 'Integration & Testing', description: 'Connecting components and testing', progress: 85, estimatedTime: 4 },
  { id: 'optimization', name: 'Final Optimization', description: 'Performance tuning and cleanup', progress: 95, estimatedTime: 2 },
  { id: 'complete', name: 'Generation Complete', description: 'Ready for deployment', progress: 100, estimatedTime: 0 }
];

// Custom Hooks
const useProgress = (stages: GenerationStage[], currentStage: string) => {
  return useMemo(() => {
    const stage = stages.find(s => s.id === currentStage);
    return stage ? stage.progress : 0;
  }, [stages, currentStage]);
};

const useRetry = (maxRetries: number = 3) => {
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(async (fn: () => Promise<any>) => {
    for (let i = 0; i <= maxRetries; i++) {
      try {
        setRetryCount(i);
        return await fn();
      } catch (error) {
        if (i === maxRetries) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
  }, [maxRetries]);

  return { retry, retryCount };
};

const useTypingEffect = (text: string, speed: number = 50) => {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!text) return;

    setIsTyping(true);
    setDisplayText('');

    let currentIndex = 0;
    const timer = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayText(prev => prev + text[currentIndex]);
        currentIndex++;
      } else {
        setIsTyping(false);
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return { displayText, isTyping };
};

// Memoized Components
const MessageBubble = memo(({ message, onDismiss }: { message: ChatMessage; onDismiss?: () => void }) => {
  const { displayText, isTyping } = useTypingEffect(
    message.sender === 'ai' ? message.content : '', 
    message.type === 'code' ? 10 : 30
  );

  return (
    <div className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
      <div className={`max-w-[85%] relative ${
        message.sender === 'user'
          ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25'
          : 'bg-gray-800/90 backdrop-blur-sm text-white border border-gray-700/50 shadow-xl'
      } rounded-xl p-4`}>

        {/* Avatar */}
        <div className={`absolute -top-2 ${message.sender === 'user' ? '-right-2' : '-left-2'} w-6 h-6 rounded-full border-2 border-gray-800 flex items-center justify-center text-xs font-semibold ${
          message.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
        }`}>
          {message.sender === 'user' ? 'U' : 'AI'}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {message.sender === 'ai' && getMessageIcon(message.type)}
            <span className="text-xs text-gray-400">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {message.type && (
              <Badge variant="outline" className="text-xs bg-gray-700/50 text-gray-300 border-gray-600">
                {message.type}
              </Badge>
            )}
          </div>
          {message.type === 'error' && onDismiss && (
            <Button variant="ghost" size="icon" onClick={onDismiss} className="h-4 w-4 hover:bg-gray-700">
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="whitespace-pre-wrap leading-relaxed">
          {message.sender === 'ai' ? (displayText || message.content) : message.content}
          {isTyping && <span className="animate-pulse">|</span>}
        </div>

        {/* Metadata */}
        {message.metadata && (
          <div className="mt-3 pt-3 border-t border-gray-700/50">
            <div className="flex flex-wrap gap-2 text-xs">
              {message.metadata.complexity && (
                <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                  {message.metadata.complexity}
                </Badge>
              )}
              {message.metadata.technologies?.map(tech => (
                <Badge key={tech} variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                  {tech}
                </Badge>
              ))}
              {message.metadata.estimatedLines && (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                  ~{message.metadata.estimatedLines} lines
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

const ProgressIndicator = memo(({ stage, progress, isVisible }: { stage: string; progress: number; isVisible: boolean }) => {
  if (!isVisible) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white">{stage}</span>
        <span className="text-xs text-gray-400">{progress}%</span>
      </div>
      <Progress value={progress} className="h-2 bg-gray-700">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </Progress>
    </div>
  );
});

const getMessageIcon = (type?: string) => {
  switch (type) {
    case 'analysis': return <Zap className="w-4 h-4 text-blue-500" />;
    case 'code': return <Code className="w-4 h-4 text-green-500" />;
    case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
    case 'system': return <Info className="w-4 h-4 text-purple-500" />;
    default: return <MessageSquare className="w-4 h-4 text-gray-400" />;
  }
};

// Helper functions - moved to top to avoid hoisting issues
const getLanguageFromFileName = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js': return 'javascript';
    case 'ts': return 'typescript';
    case 'tsx': return 'tsx';
    case 'jsx': return 'jsx';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'py': return 'python';
    case 'json': return 'json';
    default: return 'text';
  }
};

const generateFileName = (codeBlock: string, index: number): string => {
    // Try to extract filename from comment in code
    const lines = codeBlock.split('\n');
    for (const line of lines.slice(0, 5)) {
      const fileMatch = line.match(/(?:\/\/|\/\*|\#|<!--)\s*(?:filename:|file:)?\s*([a-zA-Z0-9._-]+\.[a-zA-Z0-9]+)/i);
      if (fileMatch) {
        return fileMatch[1];
      }
    }

    // Detect file type from code content
    if (codeBlock.includes('<!DOCTYPE html') || codeBlock.includes('<html')) return `index.html`;
    if (codeBlock.includes('package.json') || codeBlock.includes('"name"') && codeBlock.includes('"version"')) return 'package.json';
    if (codeBlock.includes('body {') || codeBlock.includes('@media') || codeBlock.includes('font-family:')) return 'style.css';
    if (codeBlock.includes('const express') || codeBlock.includes('app.listen')) return 'server.js';
    if (codeBlock.includes('class ') && codeBlock.includes('constructor')) return 'app.js';
    if (codeBlock.includes('function ') || codeBlock.includes('const ') || codeBlock.includes('let ')) return `script${index + 1}.js`;

    return `file${index + 1}.txt`;
  };

export default function ChatInterface({ project, onConsoleLog, onAppUpdate, onFileGenerated }: ChatInterfaceProps) {
  const { createProject } = useProjects();
  const { user } = useAuth();
  const { retry, retryCount } = useRetry(3);

  // State Management
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'ai',
      content: 'Hey! 👋 What do you want to make today?\n\nI can help you build websites, apps, games, calculators, todo lists, and more! Just tell me your idea and I\'ll create the code for you.\n\nEverything works locally now - no external APIs needed! What would you like to build?',
      timestamp: new Date(),
      type: 'system'
    }
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [liveCoding, setLiveCoding] = useState<LiveCodingState>({
    fileName: '',
    content: '',
    isActive: false,
    language: '',
    progress: 0,
    complexity: '',
    patterns: []
  });
  const [isGenerationMode, setIsGenerationMode] = useState(true);
  const [generationComplete, setGenerationComplete] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [errorAlerts, setErrorAlerts] = useState<string[]>([]);
  const [cancelToken, setCancelToken] = useState<CancelToken | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Effects
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleAutoStart = (event: CustomEvent) => {
      if (event.detail?.prompt) {
        handleSubmit(event.detail.prompt);
      }
    };

    // Check for auto-start message from landing page
    const autoStartMessage = localStorage.getItem('autoStartMessage');
    if (autoStartMessage) {
      localStorage.removeItem('autoStartMessage'); // Clear it so it doesn't auto-send again
      setTimeout(() => {
        handleSubmit(autoStartMessage);
      }, 500); // Small delay to let component fully load
    }

    window.addEventListener('autoStartGeneration' as any, handleAutoStart);
    return () => {
      window.removeEventListener('autoStartGeneration' as any, handleAutoStart);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Progress calculation
  const currentProgress = useProgress(GENERATION_STAGES, currentStage);

  // Character count for input
  const characterCount = inputValue.length;
  const maxCharacters = 2000;

  // Handlers
  const createCancelToken = useCallback((): CancelToken => {
    const token = { cancelled: false, cancel: () => {} };
    token.cancel = () => { token.cancelled = true; };
    return token;
  }, []);

  const isCodeGenerationRequest = useCallback((input: string): boolean => {
    const lowerInput = input.toLowerCase().trim();

    // Code generation keywords - anything that involves building/creating
    const codeKeywords = [
      'create', 'build', 'make', 'generate', 'develop', 'write', 'code', 'app', 'application',
      'website', 'web', 'function', 'component', 'class', 'module', 'script', 'program',
      'todo', 'calculator', 'game', 'dashboard', 'form', 'login', 'signup', 'api', 'database',
      'add', 'implement', 'design', 'setup', 'configure'
    ];

    // Check for code generation patterns
    for (const keyword of codeKeywords) {
      if (lowerInput.includes(keyword)) {
        return true; // Code generation mode
      }
    }

    // Default to chat mode for questions and explanations
    return false;
  }, []);

  const handleAIResponse = useCallback(async (userInput: string) => {
    setIsLoading(true);
    setErrorAlerts([]);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();
    const token = createCancelToken();
    setCancelToken(token);

    onConsoleLog('🤖 AI processing your request...', 'info');

    try {
      await retry(async () => {
        if (token.cancelled) throw new Error('Request cancelled');

        // Determine if this is a code generation request or chat
        const shouldGenerateCode = isCodeGenerationRequest(userInput);

        if (shouldGenerateCode) {
          await handleFileGeneration(userInput, token);
        } else {
          await handleChatResponse(userInput, token);
        }
      });

      onConsoleLog('✅ Processing completed successfully!', 'success');
    } catch (error) {
      console.error('AI Response Error:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorId = Date.now().toString();

      setErrorAlerts(prev => [...prev, errorId]);

      const aiErrorMessage: ChatMessage = {
        id: errorId,
        sender: 'ai',
        content: `❌ Error: ${errorMessage}\n\nThere seems to be an issue with the API connection. Please check:\n\n• Network connectivity\n• API endpoint availability\n• Request format\n\nTry again or provide more specific details about your project.`,
        timestamp: new Date(),
        type: 'error'
      };

      setMessages(prev => [...prev, aiErrorMessage]);
      onConsoleLog(`❌ Error: ${errorMessage}`, 'error');
    } finally {
      setIsLoading(false);
      setCurrentStage('');
      setLiveCoding(prev => ({ ...prev, isActive: false }));
      setCancelToken(null);
      abortControllerRef.current = null;
    }
  }, [isCodeGenerationRequest, retry, createCancelToken, onConsoleLog]);

  const handleSubmit = useCallback(async (message: string = inputValue) => {
    if (!message.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      content: message.trim(),
      timestamp: new Date(),
      type: 'normal'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    await handleAIResponse(message.trim());
  }, [inputValue, isLoading, handleAIResponse]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleFileGeneration = useCallback(async (userInput: string, token: CancelToken) => {
    setCurrentStage('Generating code...');

    onConsoleLog('🤖 Generating code locally...', 'info');

    const response = await fetch('/api/claude-proxy', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ prompt: userInput })
    });

    if (!response.ok) {
      throw new Error(`Response Error: ${response.status}`);
    }

    const data = await response.json();
    onConsoleLog('✅ Response received successfully', 'success');
    const aiResponse = data.response || "I'd be happy to help! Could you provide more specific details?";

    // Process code blocks and create files
    const codeBlocks = aiResponse.match(/```(\w+)?\n([\s\S]*?)```/g) || [];
    const filesCreated: string[] = [];

    if (codeBlocks.length > 0) {
      for (let i = 0; i < codeBlocks.length; i++) {
        if (token.cancelled) break;

        const block = codeBlocks[i];
        const languageMatch = block.match(/```(\w+)/);
        const language = languageMatch ? languageMatch[1] : 'text';
        const code = block.replace(/```\w*\n/, '').replace(/```$/, '');

        const fileName = generateFileName(code, i);

        if (onFileGenerated) {
          onFileGenerated(fileName, code, language);
        }

        filesCreated.push(fileName);
      }
    }

    // Show the response
    const aiMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: 'ai',
      content: aiResponse,
      timestamp: new Date(),
      type: codeBlocks.length > 0 ? 'code' : 'normal',
      metadata: filesCreated.length > 0 ? {
        filesGenerated: filesCreated,
        technologies: ['HTML', 'CSS', 'JavaScript'],
        estimatedLines: codeBlocks.reduce((acc, block) => acc + block.split('\n').length, 0)
      } : undefined
    };

    setMessages(prev => [...prev, aiMessage]);

    if (filesCreated.length > 0) {
      setGenerationComplete(true);
      setIsGenerationMode(false);
    }
  }, [onFileGenerated, onConsoleLog, generateFileName]);

  const handleChatResponse = useCallback(async (userInput: string, token: CancelToken) => {
    onConsoleLog('💬 Generating chat response...', 'info');

    const response = await fetch('/api/claude-proxy', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ prompt: userInput })
    });

    if (!response.ok) {
      throw new Error(`Response Error: ${response.status}`);
    }

    const data = await response.json();
    onConsoleLog('✅ Chat response received successfully', 'success');

    const aiMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: 'ai',
      content: data.response || "I received your message but couldn't generate a response. Please try again.",
      timestamp: new Date(),
      type: 'normal'
    };

    setMessages(prev => [...prev, aiMessage]);
  }, [onConsoleLog]);

  const simulateTyping = useCallback(async (code: string, fileName: string, language: string) => {
    const chunks = code.split('');
    let currentContent = '';

    setLiveCoding(prev => ({
      ...prev,
      fileName,
      language,
      isActive: true,
      content: ''
    }));

    for (let i = 0; i < chunks.length; i += 20) {
      currentContent += chunks.slice(i, i + 20).join('');
      const progress = Math.min((i / chunks.length) * 100, 100);

      setLiveCoding(prev => ({
        ...prev,
        content: currentContent,
        progress
      }));

      await new Promise(resolve => setTimeout(resolve, 5));
    }
  }, []);

  const saveProject = useCallback(async (prompt: string, filesCreated: string[], codeBlocks: string[]) => {
    try {
      const projectFiles: Record<string, any> = {};

      filesCreated.forEach((fileName, index) => {
        const code = codeBlocks[index]?.replace(/```\w*\n/, '').replace(/```$/, '') || '';
        projectFiles[fileName] = {
          content: code,
          language: getLanguageFromFileName(fileName),
          lastModified: new Date().toISOString()
        };
      });

      const newProject = await createProject(
        `Generated: ${prompt.slice(0, 50)}...`,
        'Generated by AI Assistant',
        projectFiles,
        user?.id || 'anonymous'
      );

      onConsoleLog('✅ Project saved with ' + filesCreated.length + ' files', 'success');
      return newProject;
    } catch (error) {
      console.error('Error saving project:', error);
      onConsoleLog('❌ Failed to save project', 'error');
      throw error;
    }
  }, [createProject, user, onConsoleLog]);

  const dismissError = useCallback((errorId: string) => {
    setErrorAlerts(prev => prev.filter(id => id !== errorId));
    setMessages(prev => prev.filter(msg => msg.id !== errorId));
  }, []);

  const cancelGeneration = useCallback(() => {
    if (cancelToken) {
      cancelToken.cancel();
      onConsoleLog('🛑 Generation cancelled by user', 'info');
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
    setCurrentStage('');
    setLiveCoding(prev => ({ ...prev, isActive: false }));
  }, [cancelToken, onConsoleLog]);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold">AI</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold">AI Assistant</h1>
                <p className="text-xs text-gray-400">
                  {isGenerationMode ? 'Generation Mode' : 'Chat Mode'}
                </p>
              </div>
            </div>
          </div>
          
          {isLoading && (
            <Button
              onClick={cancelGeneration}
              variant="outline"
              size="sm"
              className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
            >
              Cancel
            </Button>
          )}
        </div>

        {/* Progress Indicator */}
        <ProgressIndicator 
          stage={currentStage} 
          progress={currentProgress} 
          isVisible={isLoading && currentStage !== ''} 
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onDismiss={message.type === 'error' ? () => dismissError(message.id) : undefined}
          />
        ))}

        {/* Live Coding Display */}
        {liveCoding.isActive && (
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Code className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">Generating: {liveCoding.fileName}</span>
              </div>
              <span className="text-xs text-gray-400">{Math.round(liveCoding.progress)}%</span>
            </div>
            <CodeStream isActive={liveCoding.isActive} files={[liveCoding.fileName]} />
          </div>
        )}

        {/* Error Alerts */}
        {errorAlerts.map((errorId) => (
          <Alert key={errorId} className="border-red-500 bg-red-500/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              There was an error processing your request. Please try again.
            </AlertDescription>
          </Alert>
        ))}

        {isLoading && (
          <div className="flex items-center justify-center space-x-2 p-4">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm text-gray-400">
              {currentStage || 'Processing your request...'}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-gray-700 p-4">
        <div className="flex space-x-3">
          <div className="flex-1">
            <div className="relative">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={isGenerationMode ? "Describe what you want to build..." : "Ask me anything..."}
                className="pr-20 bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                disabled={isLoading}
                maxLength={maxCharacters}
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                <span className="text-xs text-gray-500">
                  {characterCount}/{maxCharacters}
                </span>
                <Button
                  onClick={() => handleSubmit()}
                  disabled={!inputValue.trim() || isLoading}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <span>Press Ctrl+Enter to send</span>
                {retryCount > 0 && (
                  <span className="text-yellow-400">
                    (Retry attempt {retryCount}/3)
                  </span>
                )}
              </div>
              
              {generationComplete && (
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-500">Generation complete</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}