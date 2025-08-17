import React, { useState } from 'react';

export default function ChatInput({ onSend, disabled }){
  const [text, setText] = useState('');
  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        if(!text.trim() || disabled) return;
        onSend(text.trim());
        setText('');
      }}
      className="flex items-center space-x-3"
    >
      <textarea
        value={text}
        onChange={e=>setText(e.target.value)}
        className="modern-input w-full px-4 py-3 rounded-2xl resize-none focus:ring-2 focus:ring-indigo-300"
        placeholder="Type a message..."
        rows={2}
        disabled={disabled}
        aria-label="Message input"
      />
      <button
        type="submit"
        disabled={!text.trim() || disabled}
        className="modern-button px-4 py-3 bg-indigo-600 text-white rounded-2xl shadow-modern hover:bg-indigo-700 disabled:opacity-50"
        aria-label="Send message"
      >
        Send
      </button>
    </form>
  )
}
