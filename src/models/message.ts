import { Component } from "obsidian";

export interface Message {
	readonly header: string;
	readonly body: string;
	readonly subtext: string;
}

export interface FormatConfig {
	readonly header?: keyof HTMLElementTagNameMap;
	readonly maxWidth?: string;
	readonly mode?: string;
}

export interface ChatBubbleOptions {
	readonly header: string;
	readonly prevHeader: string;
	readonly message: string;
	readonly subtext: string;
	readonly align: string;
	readonly continued: boolean;
	readonly colorConfigs: Map<string, string>;
	readonly formatConfigs: Map<string, string>;
	readonly sourcePath: string;
	readonly component: Component;
} 