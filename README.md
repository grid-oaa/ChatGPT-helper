# ChatGPT-helper

一款Chrome浏览器插件，支持在 `chatgpt.com` 网站右侧展示当前会话中的用户问题，点击跳转和滚动高亮同步。

## 展示

![show](assets/show.gif)

## 功能

- 自动提取当前会话中的用户提问，右侧卡片式目录展示
- 点击目录项平滑跳转到对应问题
- 页面滚动时自动高亮当前问题
- 会话切换或消息新增后自动刷新

## 目录结构

```text
.
|-- manifest.json
|-- assets
|   |-- icon-16.png
|   |-- icon-32.png
|   |-- icon-48.png
|   |-- icon-128.png
|   `-- icon.svg
`-- src
    `-- content
        |-- dom-adapter.js
        |-- index.js
        |-- sidebar.js
        `-- styles.css
```

## 本地安装

1. 下载到本地，示例目录：D:\workspace\ChatGPT-helper
2. 打开 Chrome，进入 `chrome://extensions/`
3. 打开右上角“开发者模式”
4. 点击“加载已解压的扩展程序”
5. 选择当前目录 `D:\workspace\ChatGPT-helper`

## 使用说明

1. 安装后打开 `https://chatgpt.com/`
2. 进入任意一个已有会话
3. 页面右侧会出现“刻度条”
4. 点击任一问题可快速跳转
5. 向上或向下滚动会话，高亮项会自动同步

## 说明

- 仅支持 `chatgpt.com` 网站
