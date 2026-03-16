import * as vscode from 'vscode';

function createNonce(): string {
  return Math.random().toString(36).slice(2, 12);
}

export function getPromptQueueWebviewHtml(
  webview?: vscode.Webview,
  extensionUri?: vscode.Uri,
): string {
  if (!webview || !extensionUri) {
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PromptQueue</title>
  </head>
  <body>
    <div id="promptqueue-app">PromptQueue</div>
  </body>
</html>`;
  }

  const nonce = createNonce();
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'promptqueue-view.css'),
  );
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'promptqueue-view.js'),
  );

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"
    />
    <title>PromptQueue</title>
    <link rel="stylesheet" href="${styleUri}" />
  </head>
  <body>
    <div id="promptqueue-app">PromptQueue</div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
}
