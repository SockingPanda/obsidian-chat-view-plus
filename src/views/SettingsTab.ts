import { App, PluginSettingTab, Setting } from "obsidian";
import ChatViewPlusPlugin from "../index";
import { ChatViewPlusSettings, ChatRole } from "../models/settings";

export class ChatViewPlusSettingsTab extends PluginSettingTab {
    plugin: ChatViewPlusPlugin;
    
    constructor(app: App, plugin: ChatViewPlusPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    
    override display(): void {
        const { containerEl } = this;
        containerEl.empty();
        
        containerEl.createEl("h2", { text: "聊天视图增强 设置" });
        
        // 基本设置部分
        containerEl.createEl("h3", { text: "基本设置" });
        
        new Setting(containerEl)
            .setName("使用当天日记")
            .setDesc("启用后，新聊天内容将自动保存到当天的日记中")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useDailyNote)
                .onChange(async (value) => {
                    this.plugin.settings.useDailyNote = value;
                    // 如果启用使用日记，则自动禁用绑定活动文件
                    if (value) {
                        this.plugin.settings.bindActiveFile = false;
                    }
                    await this.plugin.saveSettings();
                    // 更新设置UI
                    this.display();
                })
            );
            
        new Setting(containerEl)
            .setName("自动创建日记文件")
            .setDesc("启用后，如果当天日记不存在将自动创建")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoCreateDailyNote)
                .onChange(async (value) => {
                    this.plugin.settings.autoCreateDailyNote = value;
                    await this.plugin.saveSettings();
                })
            )
            .setDisabled(!this.plugin.settings.useDailyNote);
            
        new Setting(containerEl)
            .setName("默认日记文件夹")
            .setDesc("在找不到日记插件设置时使用的默认日记文件夹路径")
            .addText(text => text
                .setPlaceholder("例如：日记")
                .setValue(this.plugin.settings.defaultDailyNoteFolder)
                .onChange(async (value) => {
                    this.plugin.settings.defaultDailyNoteFolder = value;
                    await this.plugin.saveSettings();
                })
            )
            .setDisabled(!this.plugin.settings.useDailyNote);
            
        new Setting(containerEl)
            .setName("绑定当前活动文件")
            .setDesc("启用后，聊天内容将保存到当前打开的文件中")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.bindActiveFile)
                .onChange(async (value) => {
                    this.plugin.settings.bindActiveFile = value;
                    // 如果启用绑定活动文件，则自动禁用使用日记
                    if (value) {
                        this.plugin.settings.useDailyNote = false;
                    }
                    await this.plugin.saveSettings();
                    // 更新设置UI
                    this.display();
                })
            );
            
        new Setting(containerEl)
            .setName("默认绑定文件")
            .setDesc("如不使用日记，则使用此文件作为聊天记录保存位置")
            .addText(text => text
                .setPlaceholder("输入文件路径，例如：chat/default.md")
                .setValue(this.plugin.settings.defaultBindFile)
                .onChange(async (value) => {
                    this.plugin.settings.defaultBindFile = value;
                    await this.plugin.saveSettings();
                })
            );
        
        // 样式设置部分
        containerEl.createEl("h3", { text: "样式设置" });
        
        // 气泡样式
        new Setting(containerEl)
            .setName("气泡背景色")
            .setDesc("设置聊天气泡的背景颜色")
            .addText(text => text
                .setValue(this.plugin.settings.bubbleStyle.backgroundColor)
                .onChange(async (value) => {
                    this.plugin.settings.bubbleStyle.backgroundColor = value;
                    await this.plugin.saveSettings();
                })
            );
            
        new Setting(containerEl)
            .setName("气泡圆角")
            .setDesc("设置聊天气泡的圆角大小")
            .addText(text => text
                .setValue(this.plugin.settings.bubbleStyle.borderRadius)
                .onChange(async (value) => {
                    this.plugin.settings.bubbleStyle.borderRadius = value;
                    await this.plugin.saveSettings();
                })
            );
            
        // 字体样式
        new Setting(containerEl)
            .setName("字体大小")
            .setDesc("设置聊天文字的大小")
            .addText(text => text
                .setValue(this.plugin.settings.fontStyle.fontSize)
                .onChange(async (value) => {
                    this.plugin.settings.fontStyle.fontSize = value;
                    await this.plugin.saveSettings();
                })
            );
        
        // 角色设置部分
        containerEl.createEl("h3", { text: "角色设置" });
        
        // 添加现有角色设置
        this.plugin.settings.roles.forEach((role, index) => {
            this.createRoleSettingElement(containerEl, role, index);
        });
        
        // 添加新角色按钮
        new Setting(containerEl)
            .setName("添加新角色")
            .setDesc("创建一个新的聊天角色")
            .addButton(button => button
                .setButtonText("➕ 添加")
                .onClick(async () => {
                    const newRole: ChatRole = {
                        name: "新角色",
                        position: "left",
                        color: "grey"
                    };
                    this.plugin.settings.roles.push(newRole);
                    await this.plugin.saveSettings();
                    
                    // 重新加载设置界面以显示新角色
                    this.display();
                })
            );
            
        // 预设设置部分
        containerEl.createEl("h3", { text: "预设管理" });
        
        // 当前选中预设
        if (this.plugin.settings.presets.length > 0) {
            const presetNames = this.plugin.settings.presets.map(p => p.name);
            
            new Setting(containerEl)
                .setName("当前预设")
                .setDesc("选择要使用的角色预设")
                .addDropdown(dropdown => dropdown
                    .addOptions({
                        '': '无预设',
                        ...Object.fromEntries(presetNames.map(name => [name, name]))
                    })
                    .setValue(this.plugin.settings.currentPreset)
                    .onChange(async (value) => {
                        this.plugin.settings.currentPreset = value;
                        await this.plugin.saveSettings();
                        
                        // 如果选择了预设，加载预设中的角色
                        if (value) {
                            const preset = this.plugin.settings.presets.find(p => p.name === value);
                            if (preset) {
                                this.plugin.settings.roles = [...preset.roles];
                                await this.plugin.saveSettings();
                                this.display(); // 重新加载视图
                            }
                        }
                    })
                );
        }
        
        // 保存当前预设
        new Setting(containerEl)
            .setName("保存当前预设")
            .setDesc("将当前角色配置保存为新预设")
            .addText(text => text
                .setPlaceholder("预设名称")
                .setValue("")
            )
            .addButton(button => button
                .setButtonText("保存")
                .onClick(async (evt) => {
                    const target = evt.target as HTMLElement;
                    const textInput = target.parentElement?.parentElement?.querySelector("input");
                    if (textInput && textInput.value) {
                        const presetName = textInput.value;
                        
                        // 检查是否已存在同名预设
                        const existingIndex = this.plugin.settings.presets.findIndex(p => p.name === presetName);
                        
                        if (existingIndex >= 0) {
                            // 更新已有预设
                            this.plugin.settings.presets[existingIndex].roles = [...this.plugin.settings.roles];
                        } else {
                            // 创建新预设
                            this.plugin.settings.presets.push({
                                name: presetName,
                                roles: [...this.plugin.settings.roles]
                            });
                        }
                        
                        // 设置为当前预设
                        this.plugin.settings.currentPreset = presetName;
                        
                        await this.plugin.saveSettings();
                        textInput.value = "";
                        this.display(); // 重新加载视图
                    }
                })
            );
            
        // 显示现有预设列表
        this.plugin.settings.presets.forEach((preset, index) => {
            new Setting(containerEl)
                .setName(preset.name)
                .setDesc(`包含 ${preset.roles.length} 个角色`)
                .addButton(button => button
                    .setButtonText("删除")
                    .setClass("chat-view-delete-button")
                    .onClick(async () => {
                        // 删除预设
                        this.plugin.settings.presets.splice(index, 1);
                        
                        // 如果删除的是当前预设，清空当前预设
                        if (this.plugin.settings.currentPreset === preset.name) {
                            this.plugin.settings.currentPreset = "";
                        }
                        
                        await this.plugin.saveSettings();
                        this.display(); // 重新加载视图
                    })
                );
        });
    }
    
    /**
     * 创建角色设置元素
     */
    private createRoleSettingElement(containerEl: HTMLElement, role: ChatRole, index: number): void {
        const roleDiv = containerEl.createDiv({ cls: "chat-view-role-setting" });
        
        roleDiv.createEl("h4", { text: `角色 #${index + 1}` });
        
        new Setting(roleDiv)
            .setName("角色名称")
            .addText(text => text
                .setValue(role.name)
                .onChange(async (value) => {
                    role.name = value;
                    await this.plugin.saveSettings();
                })
            );
            
        new Setting(roleDiv)
            .setName("位置")
            .addDropdown(dropdown => dropdown
                .addOptions({
                    "left": "左侧",
                    "right": "右侧",
                    "center": "居中"
                })
                .setValue(role.position)
                .onChange(async (value) => {
                    role.position = value as 'left' | 'right' | 'center';
                    await this.plugin.saveSettings();
                })
            );
            
        new Setting(roleDiv)
            .setName("颜色")
            .addDropdown(dropdown => dropdown
                .addOptions({
                    "red": "红色",
                    "orange": "橙色",
                    "yellow": "黄色",
                    "green": "绿色",
                    "blue": "蓝色",
                    "purple": "紫色",
                    "grey": "灰色",
                    "brown": "棕色",
                    "indigo": "靛蓝",
                    "teal": "青色",
                    "pink": "粉色",
                    "slate": "石板色",
                    "wood": "木色"
                })
                .setValue(role.color)
                .onChange(async (value) => {
                    role.color = value;
                    await this.plugin.saveSettings();
                })
            );
            
        new Setting(roleDiv)
            .setName("操作")
            .addButton(button => button
                .setButtonText("删除角色")
                .setClass("chat-view-delete-button")
                .onClick(async () => {
                    this.plugin.settings.roles.splice(index, 1);
                    await this.plugin.saveSettings();
                    this.display(); // 重新加载视图
                })
            );
    }
} 