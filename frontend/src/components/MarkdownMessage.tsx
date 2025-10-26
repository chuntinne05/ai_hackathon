'use client';

// Component render markdown với syntax highlighting
// Dùng cho bot responses có format phức tạp

type Props = {
  content: string;
};

export default function MarkdownMessage({ content }: Props) {
  // Parse markdown thành HTML
  const parseMarkdown = (text: string): string => {
    let html = text;

    // Code blocks với syntax highlighting
    // Pattern: ```language\ncode\n```
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
      const language = lang || 'text';
      return `<pre class="bg-gray-800 text-gray-100 rounded-md p-4 overflow-x-auto my-2"><code class="language-${language}">${escapeHtml(code.trim())}</code></pre>`;
    });

    // Inline code: `code`
    html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-200 text-red-600 px-1 py-0.5 rounded text-sm">$1</code>');

    // Bold: **text** hoặc __text__
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold">$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong class="font-bold">$1</strong>');

    // Italic: *text* hoặc _text_
    html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em class="italic">$1</em>');

    // Links: [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, 
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-500 underline hover:text-blue-700">$1</a>');

    // Lists (unordered): - item hoặc * item
    html = html.replace(/^\s*[-*]\s+(.+)$/gm, '<li class="ml-4">$1</li>');
    html = html.replace(/(<li.*<\/li>)/s, '<ul class="list-disc list-inside space-y-1">$1</ul>');

    // Headers: # H1, ## H2, ### H3
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-3 mb-1">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>');

    // Line breaks: \n\n = new paragraph
    html = html.replace(/\n\n/g, '</p><p class="mb-2">');
    html = `<p class="mb-2">${html}</p>`;

    return html;
  };

  // Escape HTML để tránh XSS trong code blocks
  const escapeHtml = (text: string): string => {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  };

  return (
    <div 
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }}
    />
  );
}

/*
GIẢI THÍCH:

1. MARKDOWN FEATURES SUPPORT:
   ✅ Code blocks: ```language\ncode```
   ✅ Inline code: `code`
   ✅ Bold: **text** hoặc __text__
   ✅ Italic: *text* hoặc _text_
   ✅ Links: [text](url)
   ✅ Lists: - item
   ✅ Headers: #, ##, ###
   ✅ Paragraphs: \n\n

2. REGEX PATTERNS:
   - /```(\w+)?\n([\s\S]*?)```/g: Match code blocks
   - `([^`]+)`: Match inline code
   - \*\*([^*]+)\*\*: Match bold
   - Etc.

3. SECURITY:
   - escapeHtml(): Prevent XSS attacks trong code blocks
   - Code được escape trước khi render
   - Links có rel="noopener noreferrer" để security

4. STYLING:
   - Tailwind classes cho mỗi element
   - Code blocks: dark theme (bg-gray-800)
   - Inline code: light gray với text đỏ
   - Links: blue + underline + hover effect

5. LIMITATIONS (INTENTIONAL):
   - Không dùng library nặng như react-markdown
   - Simple regex parser - đủ cho 90% use cases
   - Nếu cần complex: có thể thêm library sau

6. KHI NÀO DÙNG LIBRARY:
   Nếu cần:
   - Tables support
   - Nested lists
   - Task lists [ ] [x]
   - Math equations (LaTeX)
   
   → Thì dùng: react-markdown + remark-gfm

VÍ DỤ INPUT/OUTPUT:

Input:
```
# Hello
This is **bold** and *italic*
`inline code`

```python
def hello():
    print("world")
```

- Item 1
- Item 2
```

Output: Rendered HTML với styling đẹp

TÍCH HỢP VỚI CHATMESSAGE:
- Check xem message có chứa markdown không
- Nếu có → dùng MarkdownMessage
- Nếu không → render plain text
*/