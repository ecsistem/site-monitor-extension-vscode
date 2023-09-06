import * as vscode from 'vscode';
import axios from 'axios';

interface Site {
  name: string;
  url: string;
  status?: string;
  intervalId?: NodeJS.Timeout;
}

const sites: Site[] = [];
let siteProvider: vscode.TreeView<Site>;

function checkSiteStatus(site: Site) {
  if (sites.length === 0) {
    return; // Evitar chamada à API quando a lista de sites estiver vazia
  }

  axios.get(site.url)
    .then((response) => {
      site.status = response.status === 200 ? 'online' : 'offline';
      const message = `O site ${site.name} está ${site.status === 'online' ? 'online' : 'offline'}.`;
      vscode.window.showInformationMessage(message);
      siteTreeDataProvider.refresh();
    })
    .catch((error) => {
      site.status = 'offline';
      vscode.window.showErrorMessage(`Erro ao verificar o site ${site.name}: ${error.message}`);
      siteTreeDataProvider.refresh();
    });
    console.log(`Verificando status do site: ${site.name}`);
}

class SiteTreeDataProvider implements vscode.TreeDataProvider<Site> {
  private _onDidChangeTreeData: vscode.EventEmitter<Site | undefined> = new vscode.EventEmitter<Site | undefined>();
  readonly onDidChangeTreeData: vscode.Event<Site | undefined> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: Site): vscode.TreeItem {
    const iconColor = element.status === 'online' ? '#43ff64d9' : 'red';
    const iconPath = new vscode.ThemeIcon(element.status === 'online' ? 'circle-filled' : 'circle-outline', { color: iconColor });

    const treeItem: vscode.TreeItem = {
      label: element.name,
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      command: {
        command: 'site-monitor.checkSiteStatus',
        title: 'Verificar Status do Site',
        arguments: [element],
      },
      contextValue: 'siteItem',
      iconPath,
    };

    return treeItem;
  }

  getChildren(element?: Site): Site[] {
    if (sites.length === 0) {
      // Mostrar uma mensagem quando não houver sites monitorados
      return [{ name: 'Nenhum site está sendo monitorado.', url: '' }];
    }
    return sites;
  }
}

const siteTreeDataProvider = new SiteTreeDataProvider();

function startAutoCheck(site: Site) {
  site.intervalId = setInterval(() => checkSiteStatus(site), 1 * 60 * 1000);
}

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
      siteTreeDataProvider.refresh();
      startAutoCheck(site);
      // Verificar o status somente se houver sites
      if (sites.length === 1) {
        checkSiteStatus(site);
      }
    }
  });

  const removeSiteCommand = vscode.commands.registerCommand('site-monitor.removeSite', (site: Site) => {
    const index = sites.findIndex((s) => s.url === site.url);

    if (index !== -1) {
      const removedSite = sites.splice(index, 1)[0];
      clearInterval(removedSite.intervalId);
      siteTreeDataProvider.refresh();
    }
  });

  const checkSiteStatusCommand = vscode.commands.registerCommand('site-monitor.checkSiteStatus', (site: Site) => {
    if (site.name !== 'Nenhum site está sendo monitorado') {
      checkSiteStatus(site);
    }
  });

  context.subscriptions.push(addSiteCommand);
  context.subscriptions.push(removeSiteCommand);
  context.subscriptions.push(checkSiteStatusCommand);
}

export function deactivate() {}
