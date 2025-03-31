import { App, TFile } from "obsidian";
import ChatViewPlusPlugin from "../index";
import { Notice } from "obsidian";

export class FileService {
    private plugin: ChatViewPlusPlugin;
    private app: App;
    
    constructor(plugin: ChatViewPlusPlugin) {
        this.plugin = plugin;
        this.app = plugin.app;
    }
    
    /**
     * 获取当前绑定的文件
     */
    async getTargetFile(): Promise<TFile | null> {
        try {
            console.log("==== 开始获取目标文件 ====");
            console.log(`当前设置: 使用日记=${this.plugin.settings.useDailyNote}, 绑定活动文件=${this.plugin.settings.bindActiveFile}`);
            
            // 根据设置优先级获取文件
            // 1. 如果设置了使用日记，优先尝试获取日记文件
            if (this.plugin.settings.useDailyNote) {
                console.log("已启用使用日记设置，将优先尝试获取日记文件");
                const dailyNoteFile = await this.getDailyNoteFile();
                if (dailyNoteFile) {
                    console.log(`成功获取到日记文件: ${dailyNoteFile.path}`);
                    return dailyNoteFile;
                }
                console.log("未能获取到日记文件，将尝试其他方式");
            }
            
            // 2. 如果设置了绑定活动文件，使用当前活动文件
            if (this.plugin.settings.bindActiveFile) {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && activeFile.extension === "md") {
                    console.log(`使用当前活动文件: ${activeFile.path}`);
                    return activeFile;
                }
                console.log("自动跟随活动文件已启用，但当前没有活动文件");
            }
            
            // 3. 使用默认绑定文件
            if (this.plugin.settings.defaultBindFile) {
                console.log(`正在尝试获取指定文件: ${this.plugin.settings.defaultBindFile}`);
                return await this.getOrCreateFile(this.plugin.settings.defaultBindFile);
            }
            
            console.log("未找到可用文件");
            // 如果都没有找到，提示用户
            new Notice("未找到可用文件，请在设置中配置日记或默认文件路径");
            return null;
        } catch (error) {
            console.error("获取目标文件时出错:", error);
            return null;
        }
    }
    
    /**
     * 获取指定路径的文件，不存在则创建
     */
    async getOrCreateFile(filePath: string): Promise<TFile | null> {
        // 确保文件路径有正确的扩展名
        if (!filePath.endsWith(".md")) {
            filePath += ".md";
            console.log(`添加.md扩展名: ${filePath}`);
        }
        
        try {
            // 检查文件是否存在
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                console.log(`文件已存在: ${filePath}`);
                return file;
            }
            
            console.log(`文件不存在，将创建: ${filePath}`);
            
            // 确保父目录存在
            const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));
            if (dirPath && dirPath.length > 0) {
                try {
                    const existingFolder = this.app.vault.getAbstractFileByPath(dirPath);
                    if (!existingFolder) {
                        console.log(`需要创建目录: ${dirPath}`);
                        await this.app.vault.createFolder(dirPath);
                    }
                } catch (error) {
                    console.error(`创建目录失败: ${dirPath}，错误:`, error);
                    return null;
                }
            }
            
            // 创建文件
            try {
                const newFile = await this.app.vault.create(filePath, "");
                console.log(`文件创建成功: ${filePath}`);
                return newFile;
            } catch (error) {
                console.error(`创建文件失败: ${filePath}，错误:`, error);
                return null;
            }
        } catch (error) {
            console.error(`访问/创建文件失败: ${filePath}，错误:`, error);
            return null;
        }
    }
    
    /**
     * 获取当天的日记文件
     */
    async getDailyNoteFile(): Promise<TFile | null> {
        try {
            console.log("==== 开始获取日记文件 ====");
            
            // 获取日记插件设置
            const dailyNotesSettings = this.getDailyNotesSettings();
            if (dailyNotesSettings) {
                console.log(`找到日记插件设置: 文件夹=${dailyNotesSettings.folder}, 格式=${dailyNotesSettings.format}`);
            } else {
                console.log("未找到日记插件设置，将使用插件设置中的默认日记格式");
            }
            
            if (!dailyNotesSettings) {
                // 使用默认格式：YYYY-MM-DD.md
                const today = window.moment().format("YYYY-MM-DD");
                // 使用用户在设置中定义的默认日记文件夹
                const folderPath = this.plugin.settings.defaultDailyNoteFolder || "日记";
                const filePath = `${folderPath}/${today}.md`;
                
                console.log(`尝试使用默认路径: ${filePath}`);
                
                // 检查文件是否存在，如果不存在则创建
                const existingFile = this.app.vault.getAbstractFileByPath(filePath);
                if (existingFile instanceof TFile) {
                    console.log(`日记文件已存在: ${filePath}`);
                    return existingFile;
                }
                
                // 如果设置了不自动创建日记，则返回null
                if (!this.plugin.settings.autoCreateDailyNote) {
                    console.log(`日记文件不存在: ${filePath}，且未启用自动创建`);
                    new Notice(`日记文件 ${today} 不存在，请手动创建或开启自动创建功能`);
                    return null;
                }
                
                // 创建日记文件
                console.log(`日记文件不存在: ${filePath}，将自动创建`);
                
                // 确保目录存在
                try {
                    const existingFolder = this.app.vault.getAbstractFileByPath(folderPath);
                    if (!existingFolder) {
                        await this.app.vault.createFolder(folderPath);
                        console.log(`创建日记目录成功: ${folderPath}`);
                    }
                } catch (error) {
                    console.error(`创建日记目录失败: ${folderPath}，错误:`, error);
                    new Notice(`创建日记目录失败: ${folderPath}，请检查权限或手动创建目录`);
                    return null;
                }
                
                // 创建新日记文件
                try {
                    const newFile = await this.app.vault.create(filePath, `# ${today}\n\n`);
                    console.log(`创建日记文件成功: ${filePath}`);
                    new Notice(`已创建今日日记: ${today}`);
                    return newFile;
                } catch (error) {
                    console.error(`创建日记文件失败: ${filePath}，错误:`, error);
                    new Notice(`创建日记文件失败: ${filePath}，请检查权限或空间`);
                    return null;
                }
            }
            
            // 使用日记插件设置
            const { folder, format } = dailyNotesSettings;
            const today = window.moment().format(format);
            const filePath = folder ? `${folder}/${today}.md` : `${today}.md`;
            
            console.log(`使用日记插件设置构建路径: ${filePath} (格式: ${format}, 文件夹: ${folder || "根目录"})`);
            
            // 检查文件是否存在
            const existingFile = this.app.vault.getAbstractFileByPath(filePath);
            if (existingFile instanceof TFile) {
                console.log(`日记文件已存在: ${filePath}`);
                return existingFile;
            } else {
                console.log(`日记文件不存在: ${filePath}`);
            }
            
            // 如果设置了不自动创建日记，则返回null
            if (!this.plugin.settings.autoCreateDailyNote) {
                console.log(`日记文件不存在: ${filePath}，未启用自动创建`);
                new Notice(`日记文件 ${today} 不存在，请手动创建或开启自动创建功能`);
                return null;
            }
            
            // 如果文件不存在，尝试创建
            console.log(`日记文件不存在: ${filePath}，将自动创建`);
            
            // 确保目录存在
            if (folder) {
                try {
                    const existingFolder = this.app.vault.getAbstractFileByPath(folder);
                    if (!existingFolder) {
                        await this.app.vault.createFolder(folder);
                        console.log(`创建日记目录: ${folder}`);
                    }
                } catch (error) {
                    console.error(`创建日记目录失败: ${folder}，错误:`, error);
                    new Notice(`创建日记目录失败: ${folder}，请检查权限或手动创建目录`);
                    return null;
                }
            }
            
            // 创建新日记文件
            try {
                // 尝试获取日记模板内容
                let initialContent = `# ${today}\n\n`;
                
                // 创建新文件
                const newFile = await this.app.vault.create(filePath, initialContent);
                console.log(`创建日记文件成功: ${filePath}`);
                new Notice(`已创建今日日记: ${today}`);
                return newFile;
            } catch (error) {
                console.error(`创建日记文件失败: ${filePath}，错误:`, error);
                new Notice(`创建日记文件失败: ${filePath}，请检查权限或空间`);
                return null;
            }
        } catch (error) {
            console.error("获取日记文件时出错:", error);
            return null;
        }
    }
    
    /**
     * 获取日记插件设置
     */
    private getDailyNotesSettings(): { folder: string, format: string } | null {
        try {
            console.log("开始检测日记插件设置...");
            
            // 尝试获取官方日记插件
            // @ts-ignore - 官方插件API没有直接导出类型
            const internalPlugin = this.app.internalPlugins?.plugins?.["daily-notes"];
            if (internalPlugin) {
                console.log("检测到官方日记插件");
                
                if (internalPlugin.enabled) {
                    console.log("官方日记插件已启用");
                    const options = internalPlugin.instance?.options;
                    if (options) {
                        console.log(`官方日记插件设置: 文件夹='${options.folder || ""}', 格式='${options.format || "YYYY-MM-DD"}'`);
                        return {
                            folder: options.folder || "",
                            format: options.format || "YYYY-MM-DD"
                        };
                    } else {
                        console.log("未能读取官方日记插件设置");
                    }
                } else {
                    console.log("官方日记插件未启用");
                }
            } else {
                console.log("未检测到官方日记插件");
            }
            
            // 尝试获取社区插件"Periodic Notes"
            // @ts-ignore - 社区插件API没有直接导出类型
            const periodicNotes = this.app.plugins?.plugins?.["periodic-notes"];
            if (periodicNotes) {
                console.log("检测到Periodic Notes插件");
                
                if (periodicNotes.enabled) {
                    console.log("Periodic Notes插件已启用");
                    const settings = periodicNotes.settings?.daily;
                    if (settings) {
                        console.log(`Periodic Notes插件设置: 文件夹='${settings.folder || ""}', 格式='${settings.format || "YYYY-MM-DD"}'`);
                        return {
                            folder: settings.folder || "",
                            format: settings.format || "YYYY-MM-DD"
                        };
                    } else {
                        console.log("未能读取Periodic Notes插件设置");
                    }
                } else {
                    console.log("Periodic Notes插件未启用");
                }
            } else {
                console.log("未检测到Periodic Notes插件");
            }
            
            // 尝试获取Calendar插件
            // @ts-ignore - 插件API没有直接导出类型
            const calendar = this.app.plugins?.plugins?.["calendar"];
            if (calendar) {
                console.log("检测到Calendar插件");
                
                if (calendar.enabled) {
                    console.log("Calendar插件已启用");
                    const settings = calendar.options;
                    if (settings) {
                        console.log(`Calendar插件设置: 文件夹='${settings.dailyNotesFolder || ""}', 格式='${settings.dailyNoteFormat || "YYYY-MM-DD"}'`);
                        return {
                            folder: settings.dailyNotesFolder || "",
                            format: settings.dailyNoteFormat || "YYYY-MM-DD"
                        };
                    } else {
                        console.log("未能读取Calendar插件设置");
                    }
                } else {
                    console.log("Calendar插件未启用");
                }
            } else {
                console.log("未检测到Calendar插件");
            }
            
            console.log("未找到任何可用的日记插件设置");
            return null;
        } catch (error) {
            console.error("获取日记插件设置时出错:", error);
            return null;
        }
    }
    
    /**
     * 将消息写入到文件中
     */
    async appendMessageToFile(
        file: TFile,
        roleName: string,
        position: 'left' | 'right' | 'center',
        message: string,
        chatIndex: number = 0
    ): Promise<boolean> {
        try {
            // 获取文件内容
            let content = await this.app.vault.read(file);
            
            // 提取所有聊天块
            const chatBlocks: {start: number, end: number, content: string}[] = [];
            const chatBlockRegex = /```chat(?:-md)?\n([\s\S]*?)```/g;
            let match;
            while ((match = chatBlockRegex.exec(content)) !== null) {
                chatBlocks.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    content: match[1]
                });
            }
            
            let createdNewChatBlock = false;
            
            if (chatBlocks.length > 0 && chatIndex < chatBlocks.length) {
                // 更新现有聊天块
                const targetBlock = chatBlocks[chatIndex];
                
                // 准备消息内容
                const messageTime = window.moment().format("HH:mm");
                const messageTemplate = `@${position} ${roleName} [${messageTime}]\n${message}\n___\n\n`;
                
                // 更新单个聊天块
                const beforeChat = content.substring(0, targetBlock.start);
                const chatContent = content.substring(targetBlock.start, targetBlock.end);
                const afterChat = content.substring(targetBlock.end);
                
                // 找到代码块的结束标记
                const blockClosingIndex = chatContent.lastIndexOf("```");
                if (blockClosingIndex > 0) {
                    // 插入消息到代码块结束之前
                    const newChatContent = 
                        chatContent.substring(0, blockClosingIndex) + 
                        messageTemplate + 
                        "```";
                    
                    // 组合新内容
                    content = beforeChat + newChatContent + afterChat;
                }
            } else {
                // 需要创建新聊天块
                if (content && !content.endsWith("\n\n")) {
                    content += "\n\n";
                }
                
                content += "```chat\n";
                
                // 添加角色颜色配置
                const colorConfigs = this.plugin.settings.roles
                    .map(role => `${role.name}=${role.color}`)
                    .join(", ");
                    
                content += `[${colorConfigs}]\n\n`;
                
                // 添加消息
                const messageTime = window.moment().format("HH:mm");
                const messageTemplate = `@${position} ${roleName} [${messageTime}]\n${message}\n___\n\n`;
                
                content += messageTemplate + "```";
                
                // 标记已创建新聊天块
                createdNewChatBlock = true;
            }
            
            // 保存文件
            await this.app.vault.modify(file, content);
            
            // 如果创建了新聊天块，更新当前聊天索引并保存设置
            if (createdNewChatBlock) {
                // 重新计算聊天块数量
                const updatedChatBlocksCount = await this.getChatBlocksCount(file);
                // 设置索引为最后一个聊天块
                this.plugin.settings.currentChatIndex = updatedChatBlocksCount - 1;
                // 保存设置
                await this.plugin.saveSettings();
            }
            
            return true;
        } catch (error) {
            console.error("写入消息失败:", error);
            return false;
        }
    }
    
    /**
     * 获取文件中的聊天块数量
     */
    async getChatBlocksCount(file: TFile): Promise<number> {
        try {
            const content = await this.app.vault.read(file);
            const chatBlockRegex = /```chat(?:-md)?\n([\s\S]*?)```/g;
            let count = 0;
            while (chatBlockRegex.exec(content) !== null) {
                count++;
            }
            return count;
        } catch (error) {
            console.error("获取聊天块数量失败:", error);
            return 0;
        }
    }
    
    /**
     * 创建新的聊天块
     */
    async createNewChatBlock(file: TFile): Promise<boolean> {
        try {
            let content = await this.app.vault.read(file);
            
            if (content && !content.endsWith("\n\n")) {
                content += "\n\n";
            }
            
            content += "```chat\n";
            
            // 添加角色颜色配置
            const colorConfigs = this.plugin.settings.roles
                .map(role => `${role.name}=${role.color}`)
                .join(", ");
                
            content += `[${colorConfigs}]\n\n`;
            content += "```";
            
            await this.app.vault.modify(file, content);
            return true;
        } catch (error) {
            console.error("创建新聊天块失败:", error);
            return false;
        }
    }
}