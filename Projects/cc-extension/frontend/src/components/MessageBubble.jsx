// Eine einzelne Chat-Nachricht (Blase)
// User-Nachrichten: rechts, Claude-Antworten: links, System-Updates: zentriert
export default function MessageBubble({ message }) {
    const { role, content, attachments } = message;

    if (role === 'system') {
        return (
            <div className="msg-system">
                <div className="msg-system-bubble">
                    {content.split('\n').map((line, i) => (
                        <span key={i}>{line}{i < content.split('\n').length - 1 && <br />}</span>
                    ))}
                </div>
            </div>
        );
    }

    const isUser = role === 'user';

    return (
        <div className={`msg-row ${isUser ? 'msg-user-row' : 'msg-assistant-row'}`}>
            <div className={`msg-bubble ${isUser ? 'msg-bubble-user' : 'msg-bubble-assistant'}`}>
                {/* Angehängte Bilder über dem Text anzeigen */}
                {attachments && attachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: content ? '8px' : '0' }}>
                        {attachments.map((url, i) => (
                            <img
                                key={i}
                                src={url}
                                alt="Anhang"
                                style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px', objectFit: 'cover' }}
                            />
                        ))}
                    </div>
                )}
                {content.split('\n').map((line, i) => (
                    <span key={i}>
                        {line}
                        {i < content.split('\n').length - 1 && <br />}
                    </span>
                ))}
            </div>
        </div>
    );
}
