'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './AskAI.module.css';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface AskAIProps {
    meetingContext?: string;
}

const MODELS = [
    { id: 'auto', label: 'Auto', dot: '#f59e0b' },
    { id: 'gpt-4o', label: 'GPT-4o', section: 'Recommended' },
    { id: 'gpt-4.1', label: 'GPT-4.1' },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { id: 'gpt-5', label: 'GPT-5' },
];

const SUGGESTIONS = [
    { icon: '✨', text: 'Recap this week\'s meetings' },
    { icon: '❓', text: 'Which issues are impacting our customers?' },
    { icon: '❓', text: 'How are our recruitment efforts going?' },
    { icon: '❓', text: 'What are the current priorities?' },
];

export default function AskAI({ meetingContext }: AskAIProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedModel, setSelectedModel] = useState('auto');
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [modelSearch, setModelSearch] = useState('');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Auto scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowModelDropdown(false);
                setModelSearch('');
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // Focus input when panel opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 200);
        }
    }, [isOpen]);

    const filteredModels = MODELS.filter(m =>
        m.label.toLowerCase().includes(modelSearch.toLowerCase())
    );

    const getModelLabel = () => {
        return MODELS.find(m => m.id === selectedModel)?.label || 'Auto';
    };

    const sendMessage = async (text: string) => {
        if (!text.trim() || loading) return;

        const userMessage: ChatMessage = { role: 'user', content: text.trim() };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setInput('');
        setLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
                    model: selectedModel,
                    meetingContext,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setMessages([...updatedMessages, { role: 'assistant', content: data.reply }]);
            } else {
                setMessages([...updatedMessages, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
            }
        } catch {
            setMessages([...updatedMessages, { role: 'assistant', content: 'Network error. Please check your connection.' }]);
        }

        setLoading(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    const handleNewChat = () => {
        setMessages([]);
        setInput('');
    };

    const showSuggestions = messages.length === 0;

    return (
        <>
            {/* FAB Button */}
            <button
                className={`${styles.fab} ${isOpen ? styles.fabHidden : ''}`}
                onClick={() => setIsOpen(true)}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                Ask AI
            </button>

            {/* Chat Panel */}
            {isOpen && (
                <div className={styles.panel}>
                    {/* Header */}
                    <div className={styles.header}>
                        <span className={styles.headerTitle}>New chat</span>
                        <div className={styles.headerActions}>
                            <button className={styles.headerBtn} onClick={handleNewChat} title="New chat">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
                            </button>
                            <button className={styles.headerBtn} onClick={() => setIsOpen(false)} title="Close">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className={styles.body}>
                        {/* Suggestions */}
                        {showSuggestions && (
                            <div className={styles.suggestions}>
                                {SUGGESTIONS.map((s, i) => (
                                    <button
                                        key={i}
                                        className={styles.suggestion}
                                        onClick={() => sendMessage(s.text)}
                                    >
                                        <span className={styles.suggestionIcon}>{s.icon}</span>
                                        {s.text}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Messages */}
                        {messages.map((msg, i) => (
                            <div key={i} className={`${styles.message} ${styles[msg.role]}`}>
                                {msg.role === 'assistant' ? (
                                    <div className={styles.assistantContent}>
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                ) : (
                                    <div className={styles.userContent}>{msg.content}</div>
                                )}
                            </div>
                        ))}

                        {loading && (
                            <div className={`${styles.message} ${styles.assistant}`}>
                                <div className={styles.typing}>
                                    <span /><span /><span />
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className={styles.inputArea}>
                        <div className={styles.inputWrapper}>
                            <textarea
                                ref={inputRef}
                                className={styles.input}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask me anything..."
                                rows={1}
                            />
                        </div>
                        <div className={styles.inputFooter}>
                            <span className={styles.scope}>In All Meetings</span>

                            <div className={styles.modelSelector} ref={dropdownRef}>
                                <button
                                    className={styles.modelBtn}
                                    onClick={() => {
                                        setShowModelDropdown(!showModelDropdown);
                                        setModelSearch('');
                                    }}
                                >
                                    {getModelLabel()}
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                                </button>

                                {showModelDropdown && (
                                    <div className={styles.dropdown}>
                                        <div className={styles.dropdownSearch}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                                            <input
                                                className={styles.dropdownInput}
                                                placeholder="Search model..."
                                                value={modelSearch}
                                                onChange={e => setModelSearch(e.target.value)}
                                                autoFocus
                                            />
                                        </div>
                                        <div className={styles.dropdownList}>
                                            {filteredModels.map((model, i) => (
                                                <React.Fragment key={model.id}>
                                                    {model.section && (
                                                        <div className={styles.dropdownSection}>{model.section}</div>
                                                    )}
                                                    <button
                                                        className={`${styles.dropdownItem} ${selectedModel === model.id ? styles.dropdownItemActive : ''}`}
                                                        onClick={() => {
                                                            setSelectedModel(model.id);
                                                            setShowModelDropdown(false);
                                                            setModelSearch('');
                                                        }}
                                                    >
                                                        {model.dot && (
                                                            <span className={styles.modelDot} style={{ background: model.dot }} />
                                                        )}
                                                        <span className={styles.modelLabel}>{model.label}</span>
                                                        {selectedModel === model.id && (
                                                            <svg className={styles.checkmark} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                                                        )}
                                                    </button>
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                className={styles.sendBtn}
                                onClick={() => sendMessage(input)}
                                disabled={!input.trim() || loading}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
