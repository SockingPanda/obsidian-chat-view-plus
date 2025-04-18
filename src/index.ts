import { Plugin } from "obsidian";
import { MarkdownChatParser } from "./parsers/markdown-chat-parser";
import { ChatBubbleRenderer } from "./renderers/chat-bubble";
import { ChatViewPlusSettings, DEFAULT_SETTINGS } from "./models/settings";
import { ChatViewPlusSettingsTab } from "./views/SettingsTab";
import { ChatView } from "./views/ChatView";
import { CHAT_VIEW_TYPE } from "./constants/view";
import { FileService } from "./services/FileService";
import { TFile } from "obsidian";

/**
 * 聊天视图增强插件主类
 * 用于管理聊天视图的核心功能，包括设置、文件服务和视图注册
 */
export default class ChatViewPlusPlugin extends Plugin {
    settings: ChatViewPlusSettings;
    fileService: FileService;
    currentTargetFile: TFile | null = null;
    
    /**
     * 插件加载函数
     * 初始化插件设置、服务和视图
     * @returns Promise表示操作完成
     * @override
     * @public
     */
    override async onload(): Promise<void> {
        await this.loadSettings();
        
        // 初始化文件服务
        this.fileService = new FileService(this);
        
        // 尝试获取初始目标文件
        console.log("插件加载完成，开始初始化目标文件...");
        if (this.settings.useDailyNote) {
            console.log("启用了使用日记设置，将尝试绑定到日记文件");
        }
        await this.refreshTargetFile();
        
        // 注册设置页面
        this.addSettingTab(new ChatViewPlusSettingsTab(this.app, this));
        
        // 注册视图
        this.registerView(
            CHAT_VIEW_TYPE,
            (leaf) => new ChatView(leaf, this)
        );
        
        // 添加打开聊天窗口的命令
        this.addCommand({
            id: "open-chat-view",
            name: "打开聊天窗口",
            callback: () => this.openChatView()
        });
        
        // 注册Markdown代码块处理器
        // 只保留 Markdown 聊天格式
        this.registerMarkdownCodeBlockProcessor("chat-md", (source, el, context) => {
            MarkdownChatParser.parse(source, el, context.sourcePath, ChatBubbleRenderer.render, this);
        });
        
        // 也提供简写形式 'chat'，方便使用
        this.registerMarkdownCodeBlockProcessor("chat", (source, el, context) => {
            MarkdownChatParser.parse(source, el, context.sourcePath, ChatBubbleRenderer.render, this);
        });
    }
    
    /**
     * 插件卸载函数
     * 清理视图和资源
     * @returns Promise表示操作完成
     * @override
     * @public
     */
    override async onunload(): Promise<void> {
        this.app.workspace.detachLeavesOfType(CHAT_VIEW_TYPE);
    }
    
    /**
     * 加载插件设置
     * 从Obsidian数据中加载插件配置
     * @returns Promise表示操作完成
     * @public
     */
    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    
    /**
     * 保存插件设置
     * 将当前配置保存到Obsidian数据中并刷新目标文件
     * @returns Promise表示操作完成
     * @public
     */
    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        // 设置变更后刷新目标文件
        this.refreshTargetFile();
    }
    
    /**
     * 刷新当前目标文件
     * 清除缓存并重新获取目标文件
     * @returns Promise表示操作完成
     * @public
     */
    async refreshTargetFile(): Promise<void> {
        // 强制重新获取目标文件，清除缓存
        this.currentTargetFile = null;
        
        // 获取新的目标文件
        this.currentTargetFile = await this.fileService.getTargetFile();
        
        if (this.currentTargetFile) {
            console.log(`当前目标文件已更新: ${this.currentTargetFile.path}`);
        } else {
            console.log("未能设置目标文件");
        }
    }
    
    /**
     * 打开聊天视图
     * 创建或激活聊天视图窗口
     * @returns Promise表示操作完成
     * @public
     */
    async openChatView(): Promise<void> {
        // 如果已经打开了聊天视图，则激活它
        const existing = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE);
        if (existing.length) {
            this.app.workspace.revealLeaf(existing[0]);
            return;
        }
        
        // 否则创建新的聊天视图
        const leaf = this.app.workspace.getRightLeaf(false);
        if (!leaf) return;
        
        await leaf.setViewState({
            type: CHAT_VIEW_TYPE,
            active: true
        });
        
        this.app.workspace.revealLeaf(leaf);
    }
} 