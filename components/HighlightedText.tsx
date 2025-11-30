import React from 'react';
import { SearchMatch } from '../types';

interface HighlightedTextProps {
  text: string;
  matches?: SearchMatch[];
  className?: string;
  maxLength?: number;
}

const HighlightedText: React.FC<HighlightedTextProps> = ({ 
  text, 
  matches = [], 
  className = '',
  maxLength 
}) => {
  if (!matches || matches.length === 0) {
    // If no matches, just return the text (truncated if needed)
    const displayText = maxLength ? text.slice(0, maxLength) + (text.length > maxLength ? '...' : '') : text;
    return <span className={className}>{displayText}</span>;
  }

  // Sort matches by start position
  const sortedMatches = [...matches].sort((a, b) => a.start - b.start);

  // Build the highlighted text
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of sortedMatches) {
    // Add text before the match
    if (match.start > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {text.slice(lastIndex, match.start)}
        </span>
      );
    }

    // Add the highlighted match
    parts.push(
      <mark 
        key={`match-${match.start}`}
        className="bg-yellow-200 text-black font-medium px-0.5 rounded"
      >
        {text.slice(match.start, match.end)}
      </mark>
    );

    lastIndex = match.end;
  }

  // Add remaining text after the last match
  if (lastIndex < text.length) {
    parts.push(
      <span key={`text-${lastIndex}`}>
        {text.slice(lastIndex)}
      </span>
    );
  }

  // Truncate if needed
  if (maxLength) {
    // Join parts and truncate
    const fullText = parts.map(part => {
      if (typeof part === 'string') return part;
      if (part.props && typeof part.props.children === 'string') return part.props.children;
      return '';
    }).join('');
    
    if (fullText.length > maxLength) {
      // Simplified truncation for highlighted text
      const truncatedText = text.slice(0, maxLength) + '...';
      return <HighlightedText text={truncatedText} matches={matches.filter(m => m.start < maxLength)} className={className} />;
    }
  }

  return <span className={className}>{parts}</span>;
};

export default HighlightedText;
