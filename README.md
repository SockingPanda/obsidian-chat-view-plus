# Obsidian Chat View Plus

A plugin for Obsidian that enables elegant chat interfaces within Markdown files. This project draws inspiration from [Obsidian Chat View](https://github.com/adifyr/obsidian-chat-view).

[中文说明](README_CN.md)

## Features

- **Elegant Chat Interface**: Create chat app-like interfaces in your Obsidian notes for intuitive conversation presentation
- **Full Markdown Support**: Messages support all Markdown formatting features
- **Versatile Layout Options**: Left, right, and center-aligned message bubbles
- **Customizable Participants**: Define names and colors for chat participants
- **Timestamp Support**: Add time markers to record the conversation timeline
- **Rich Annotation System**: Support for timestamped notes and regular annotations
- **Intuitive Syntax**: Newly designed syntax structure that's easy to use
- **Multiple Chat Blocks**: Support for managing multiple chat conversations within a single file
- **Daily Notes Integration**: Seamless integration with Obsidian's Daily Notes functionality
- **Dynamic Island UI**: Modern interface with chat block selection and file binding controls

## Usage

Create a code block in your Obsidian note using the `chat` or `chat-md` language identifier:

```
\```chat
{header=h3, mw=80}
[Alice=blue, Bob=red]

@left Alice [2025-03-31 00:11]
This is a left-aligned message

I can use complete Markdown formatting, for example:
# Heading 1
## Heading 2

- List item 1
- List item 2
  - Nested list item

1. Ordered list
2. Second item

**Bold** *Italic* ~~Strikethrough~~

> Blockquote


[Link](https://example.com)
___

@right Bob [Jan 1, 2023 10:05]
This is a right-aligned reply message

- [ ] Uncompleted task
- [x] Completed task

| Header 1 | Header 2 |
|----------|----------|
| Content 1 | Content 2 |
| Content 3 | Content 4 |
___

[2025-03-31 00:11] This text outside message blocks will automatically be treated as an annotation.
\```
```

### Syntax Guide

1. **Configuration**:
   - Use `{key=value}` format for global settings, e.g., `{header=h3, mw=80}`
   - Use `[name=color]` format to define participant colors, multiple definitions can be set: `[Alice=blue, Bob=red]`

2. **Message Format**:
   - Message start: `@left|@right|@center [name] [time]`
   - Message content: Supports full Markdown syntax including headings, lists, tables, quotes, etc.
   - Message end: Use `___` (three underscores) as a separator

3. **Annotation Types**:
   - Timestamped notes: `[time] note content` - Centered notes with timestamps
   - Regular annotations: Text entered directly, automatically centered

### Advanced Features

1. **Multiple Chat Blocks**:
   - You can have multiple chat conversations in a single file
   - Switch between different chat blocks using the dropdown in the UI
   - Create new chat blocks with the "+" button

2. **File Binding Options**:
   - Bind to Daily Notes: Automatically use your daily note for chat content
   - Bind to Active File: Follow whatever file you're currently editing
   - Bind to Specific File: Set a dedicated file for your chat content

## Acknowledgements

This project draws inspiration from the [Obsidian Chat View](https://github.com/adifyr/obsidian-chat-view) plugin by Aditya Majethia.

## License

This project is released under the [MIT License](LICENSE).
