import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Terminal, MessageSquare, RefreshCw, Trash } from 'lucide-react';
import { Project } from '@/lib/file-system';
import ChatInterface from './chat-interface-new';

interface RightPanelProps {
  project: Project;
  activeFile: string | null;
}

type TabType = 'preview' | 'console' | 'chat';

export default function RightPanel({ project, activeFile }: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('console');
  const [consoleOutput, setConsoleOutput] = useState([
    { timestamp: new Date().toLocaleTimeString(), message: '$ Ready', type: 'success' }
  ]);

  const tabs = [
    { id: 'preview' as TabType, label: 'Preview', icon: Eye },
    { id: 'console' as TabType, label: 'Console', icon: Terminal },
    { id: 'chat' as TabType, label: 'Chat', icon: MessageSquare }
  ];

  const handleRefreshPreview = () => {
    // Force refresh the preview iframe
    const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src;
    }
  };

  const handleClearConsole = () => {
    setConsoleOutput([
      { timestamp: new Date().toLocaleTimeString(), message: '$ Console cleared', type: 'info' }
    ]);
  };

  const addToConsole = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setConsoleOutput(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    }]);
  };

  const renderPreviewContent = () => {
    if (project.files['index.html']) {
      const htmlContent = project.files['index.html'].content;
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      return (
        <div className="flex-1 bg-white m-4 rounded-lg overflow-hidden">
          <iframe
            id="preview-iframe"
            src={url}
            className="w-full h-full border-none"
            title="Preview"
          />
        </div>
      );
    }
    
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--replit-text-dim)]">
        <div className="text-center">
          <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No preview available</p>
          <p className="text-sm">Create an index.html file to see preview</p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-[var(--replit-border)]">
        {tabs.map(tab => (
          <Button
            key={tab.id}
            variant="ghost"
            className={`flex-1 py-3 px-4 text-sm font-medium rounded-none border-b-2 border-transparent transition-colors ${
              activeTab === tab.id
                ? 'tab-button active bg-[var(--replit-hover)] border-[var(--replit-accent)]'
                : 'hover:bg-[var(--replit-hover)]'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon className="mr-2 h-4 w-4" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'preview' && (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-[var(--replit-border)]">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Live Preview</h3>
                <Button variant="ghost" size="icon" onClick={handleRefreshPreview}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {renderPreviewContent()}
          </div>
        )}

        {activeTab === 'console' && (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-[var(--replit-border)]">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Console</h3>
                <Button variant="ghost" size="icon" onClick={handleClearConsole}>
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 p-4 overflow-y-auto font-mono text-sm space-y-1">
              {consoleOutput.map((entry, index) => (
                <div
                  key={index}
                  className={`${
                    entry.type === 'success' ? 'text-green-400' :
                    entry.type === 'error' ? 'text-red-400' :
                    'text-[var(--replit-text-dim)]'
                  }`}
                >
                  <span className="text-[var(--replit-text-dim)]">[{entry.timestamp}]</span> {entry.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <ChatInterface 
            project={project}
            onConsoleLog={addToConsole}
          />
        )}
      </div>
    </div>
  );
}
