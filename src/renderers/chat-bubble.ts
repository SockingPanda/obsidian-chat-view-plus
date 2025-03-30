import { MarkdownRenderer, Platform, Component } from "obsidian";
import { ChatBubbleOptions } from "../models/message";

export class ChatBubbleRenderer {
    public static render(element: HTMLElement, options: ChatBubbleOptions): void {
        const {
            header,
            prevHeader,
            message,
            subtext,
            align,
            continued,
            colorConfigs,
            formatConfigs,
            sourcePath,
            component
        } = options;

        const marginClass = continued ? "chat-view-small-vertical-margin" : "chat-view-default-vertical-margin";
        const colorConfigClass = `chat-view-${colorConfigs.get(continued ? prevHeader : header)}`;
        const widthClass = formatConfigs.has("mw") ?
            `chat-view-max-width-${formatConfigs.get("mw")}`
            : (Platform.isMobile ? "chat-view-mobile-width" : "chat-view-desktop-width");
        const modeClass = `chat-view-bubble-mode-${formatConfigs.has("mode") ? formatConfigs.get("mode") : "default"}`;
        const headerEl: keyof HTMLElementTagNameMap = formatConfigs.has("header") ?
            formatConfigs.get("header") as keyof HTMLElementTagNameMap :
            "h4";
            
        const bubble = element.createDiv({
            cls: ["chat-view-bubble", `chat-view-align-${align}`, marginClass, colorConfigClass, widthClass, modeClass]
        });
        
        if (header.length > 0) {
            bubble.createEl(headerEl, {text: header, cls: ["chat-view-header"]});
        }
        
        if (message.length > 0) {
            const messageContainer = bubble.createDiv({
                cls: ["chat-view-message-container"]
            });
            
            MarkdownRenderer.renderMarkdown(
                message, 
                messageContainer, 
                sourcePath, 
                component
            );
        }
        
        if (subtext.length > 0) {
            bubble.createEl("sub", {text: subtext, cls: ["chat-view-subtext"]});
        }
    }
} 