/**
 * 角色设定
 */
export interface ChatRole {
    name: string;         // 角色名称
    position: 'left' | 'right' | 'center'; // 聊天气泡位置
    color: string;        // 颜色
    bubbleStyle?: string; // 气泡样式
    fontStyle?: string;   // 字体样式
    template?: string;    // 输出模板
    group?: string;       // 角色分组
}

/**
 * 预设配置
 */
export interface ChatPreset {
    name: string;        // 预设名称
    roles: ChatRole[];   // 角色列表
}

/**
 * 插件设置接口
 */
export interface ChatViewPlusSettings {
    // 默认绑定文件
    defaultBindFile: string;  // 文件路径
    useDailyNote: boolean;    // 是否使用日记
    autoCreateDailyNote: boolean; // 是否自动创建日记文件
    defaultDailyNoteFolder: string; // 默认日记文件夹路径
    bindActiveFile: boolean;  // 是否绑定当前活动文件
    
    // 当前活动的聊天块索引
    currentChatIndex: number;
    
    // 气泡样式
    bubbleStyle: {
        backgroundColor: string;
        borderRadius: string;
        borderWidth: string;
        borderColor: string;
        shadow: string;
    };
    
    // 字体样式
    fontStyle: {
        fontFamily: string;
        fontSize: string;
        lineHeight: string;
        fontColor: string;
    };
    
    // 角色设定
    roles: ChatRole[];
    
    // 预设
    presets: ChatPreset[];
    currentPreset: string; // 当前使用的预设名称
}

/**
 * 默认设置
 */
export const DEFAULT_SETTINGS: ChatViewPlusSettings = {
    defaultBindFile: "",
    useDailyNote: false,
    autoCreateDailyNote: true,
    defaultDailyNoteFolder: "日记",
    bindActiveFile: true,
    currentChatIndex: 0,
    
    bubbleStyle: {
        backgroundColor: "#f0f0f0",
        borderRadius: "10px",
        borderWidth: "1px",
        borderColor: "#e0e0e0",
        shadow: "0 1px 2px rgba(0,0,0,0.1)"
    },
    
    fontStyle: {
        fontFamily: "",
        fontSize: "14px",
        lineHeight: "1.5",
        fontColor: "#333333"
    },
    
    roles: [
        {
            name: "我",
            position: "right",
            color: "blue"
        },
        {
            name: "对方",
            position: "left",
            color: "grey"
        }
    ],
    
    presets: [],
    currentPreset: ""
}; 