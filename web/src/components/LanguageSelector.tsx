import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { SupportedLanguage } from '../utils/cookie';
import { LANGUAGE_LIST, LanguageInfo } from '../i18n/translations';

interface LanguageSelectorProps {
  currentLang: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  ariaLabel?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLang,
  onLanguageChange,
  ariaLabel = 'Select language',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentInfo =
    LANGUAGE_LIST.find((item) => item.code === currentLang) || LANGUAGE_LIST[0];

  // Close on outside click or escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (lang: SupportedLanguage) => {
    onLanguageChange(lang);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#FFFCF1',
          color: '#100C0A',
          border: '2px solid #100C0A',
          borderRadius: '999px',
          padding: '7px 14px',
          fontWeight: 700,
          fontSize: '13px',
          cursor: 'pointer',
          boxShadow: isOpen ? '2px 2px 0 #100C0A' : '3px 3px 0 #100C0A',
          transform: isOpen ? 'translate(1px, 1px)' : 'none',
          transition: 'all 0.1s ease',
          outline: 'none',
        }}
      >
        <Globe size={15} strokeWidth={2.3} style={{ color: '#002A45' }} />
        <span style={{ fontSize: '13px' }}>{currentInfo.flag}</span>
        <span style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
          {currentInfo.nativeName}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={2.5}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            color: '#6E5F50',
          }}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 100,
            minWidth: '200px',
            background: '#FFFCF1',
            border: '2.5px solid #100C0A',
            borderRadius: '12px',
            boxShadow: '6px 6px 0 #100C0A',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div
            style={{
              padding: '6px 10px 4px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              color: '#6E5F50',
              borderBottom: '1px dashed rgba(16,12,10,.18)',
              marginBottom: '4px',
            }}
          >
            Select Language · 語言選擇
          </div>

          {LANGUAGE_LIST.map((item: LanguageInfo) => {
            const isSelected = item.code === currentLang;
            return (
              <button
                key={item.code}
                role="menuitem"
                onClick={() => handleSelect(item.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: isSelected ? '1.5px solid #100C0A' : '1px solid transparent',
                  background: isSelected ? '#FFF1A6' : 'transparent',
                  color: '#100C0A',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: isSelected ? 800 : 600,
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'rgba(16,12,10,.05)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '15px' }}>{item.flag}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                    <span>{item.nativeName}</span>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '10px',
                        color: '#6E5F50',
                      }}
                    >
                      {item.name}
                    </span>
                  </div>
                </div>
                {isSelected && <Check size={16} strokeWidth={3} style={{ color: '#100C0A' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
