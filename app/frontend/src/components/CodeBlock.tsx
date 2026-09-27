import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = 'json', title }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-container">
      <div className="code-header">
        <span>{title || language.toUpperCase()}</span>
        <button
          onClick={handleCopy}
          className="btn btn-secondary btn-sm"
          style={{ padding: '2px 8px', fontSize: '0.72rem', height: '24px' }}
        >
          {copied ? <Check size={12} color="var(--color-success)" /> : <Copy size={12} />}
          <span>{copied ? 'COPIED' : 'COPY'}</span>
        </button>
      </div>
      <pre>{code}</pre>
    </div>
  );
};
