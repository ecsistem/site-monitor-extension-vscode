import * as vscode from 'vscode';
import axios from 'axios';

interface Site {
  name: string;
  url: string;
}

const sites: Site[] = [];
let siteProvider: vscode.TreeView<Site>;

function checkSiteStatus(site: Site) {
  axios.get(site.url)
    .then((response) => {
      if (response.status === 200) {
        vscode.window.showInformationMessage(`O site ${site.name} está online.`);
      } else {
        vscode.window.showErrorMessage(`O site ${site.name} está fora do ar!`);
      }
    })
    .catch((error) => {
      vscode.window.showErrorMessage(`Erro ao verificar o site ${site.name}: ${error.message}`);
    });
}

// Implemente uma classe que estende TreeDataProvider para atualizar os dados da árvore
class SiteTreeDataProvider implements vscode.TreeDataProvider<Site> {
  private _onDidChangeTreeData: vscode.EventEmitter<Site | undefined> = new vscode.EventEmitter<Site | undefined>();
  readonly onDidChangeTreeData: vscode.Event<Site | undefined> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: Site): vscode.TreeItem {
    return {
      label: element.name,
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      command: {
        command: 'site-monitor.checkSiteStatus',
        title: 'Verificar Status do Site',
        arguments: [element],
      },
    };
  }

  getChildren(element?: Site): Site[] {
    return sites;
  }
}

const siteTreeDataProvider = new SiteTreeDataProvider();

export function activate(context: vscode.ExtensionContext) {
  siteProvider = vscode.window.createTreeView('site-monitor.sites', {
    treeDataProvider: siteTreeDataProvider,
  });

  const addSiteCommand = vscode.commands.registerCommand('site-monitor.addSite', async () => {
    const name = await vscode.window.showInputBox({
      prompt: 'Digite o nome do site',
      placeHolder: 'Exemplo: Meu Site',
    });

    const url = await vscode.window.showInputBox({
      prompt: 'Digite a URL do site',
      placeHolder: 'Exemplo: https://example.com',
    });

    if (name && url) {
      const site: Site = { name, url };
      sites.push(site);
      siteTreeDataProvider.refresh(); // Atualize a visualização da árvore
      setInterval(() => checkSiteStatus(site), 5 * 60 * 1000);
    }
  });

  context.subscriptions.push(addSiteCommand);

  context.subscriptions.push(vscode.commands.registerCommand('site-monitor.checkSiteStatus', (site: Site) => {
    checkSiteStatus(site);
  }));
}

export function deactivate() {}
