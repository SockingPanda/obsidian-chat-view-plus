import { Plugin } from "obsidian";
import { MarkdownChatParser } from "./parsers/markdown-chat-parser";
import { ChatBubbleRenderer } from "./renderers/chat-bubble";

export default class ChatViewPlusPlugin extends Plugin {
    override async onload(): Promise<void> {
        // 只保留 Markdown 聊天格式
        this.registerMarkdownCodeBlockProcessor("chat-md", (source, el, context) => {
            MarkdownChatParser.parse(source, el, context.sourcePath, ChatBubbleRenderer.render, this);
        });
        
        // 也提供简写形式 'chat'，方便使用
        this.registerMarkdownCodeBlockProcessor("chat", (source, el, context) => {
            MarkdownChatParser.parse(source, el, context.sourcePath, ChatBubbleRenderer.render, this);
        });
    }
} 