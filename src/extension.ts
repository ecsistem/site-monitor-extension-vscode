import * as vscode from 'vscode';
import axios, { AxiosError } from 'axios';

interface Site {
  name: string;
  url: string;
  status?: string;
  intervalId?: NodeJS.Timeout;
  intervalInMinutes: boolean;
}

const sites: Site[] = [];
let siteProvider: vscode.TreeView<Site>;

async function checkSiteStatus(site: Site) {
  if (sites.length === 0) {
    return; // Evitar chamada à API quando a lista de sites estiver vazia
  }

  try {
    const response = await axios.get(site.url);
    site.status = response.status === 200 ? 'online' : 'offline';
    const message = `O site ${site.name} está ${site.status === 'online' ? 'online' : 'offline'}.`;
    vscode.window.showInformationMessage(message);
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      // Verifique se o erro é uma instância de AxiosError
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        // Se houver uma resposta de erro da API
        vscode.window.showErrorMessage(`Erro ao verificar o site ${site.name}: ${axiosError.message}`);
      } else {
        // Caso contrário, tratamento genérico de erro
        vscode.window.showErrorMessage(`Erro ao verificar o site ${site.name}: ${error.message}`);
      }
    } else {
      // Tratamento genérico de erro
      vscode.window.showErrorMessage(`Erro ao verificar o site ${site.name}: ${error.message}`);
    }
    site.status = 'offline';
  } finally {
    siteTreeDataProvider.refresh(); // Chame refresh diretamente na instância de siteTreeDataProvider
  }

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
      return [{ name: 'Nenhum site está sendo monitorado.', url: '', intervalInMinutes: true }];
    }
    return sites;
  }
}

const siteTreeDataProvider = new SiteTreeDataProvider();

async function addSiteCommand() {
  const name = await vscode.window.showInputBox({
    prompt: 'Digite o nome do site',
    placeHolder: 'Exemplo: Meu Site',
  });

  const url = await vscode.window.showInputBox({
    prompt: 'Digite a URL do site',
    placeHolder: 'Exemplo: https://example.com',
  });

  const intervalOptions = ['Em minutos', 'Em segundos'];
  const selectedInterval = await vscode.window.showQuickPick(intervalOptions, {
    placeHolder: 'Selecione o intervalo de verificação',
  });

  if (!name || !url || !selectedInterval) {
    return; // Saia se algum campo for vazio ou se o usuário cancelar
  }

  const site: Site = {
    name,
    url,
    intervalInMinutes: selectedInterval === 'Em minutos',
  };

  sites.push(site);
  siteTreeDataProvider.refresh();
  startAutoCheck(site);

  if (sites.length === 1) {
    checkSiteStatus(site);
  }
}

function startAutoCheck(site: Site) {
  const intervalInSeconds = site.intervalInMinutes ? 60 : 1;
  site.intervalId = setInterval(() => checkSiteStatus(site), intervalInSeconds * 1000);
}

export function activate(context: vscode.ExtensionContext) {
  siteProvider = vscode.window.createTreeView('site-monitor.sites', {
    treeDataProvider: siteTreeDataProvider,
  });

  context.subscriptions.push(vscode.commands.registerCommand('site-monitor.addSite', addSiteCommand));
  context.subscriptions.push(vscode.commands.registerCommand('site-monitor.removeSite', (site: Site) => removeSite(site)));
  context.subscriptions.push(vscode.commands.registerCommand('site-monitor.checkSiteStatus', (site: Site) => checkSiteStatus(site)));
  
}

function removeSite(site: Site) {
  const index = sites.findIndex((s) => s.url === site.url);

  if (index !== -1) {
    const removedSite = sites.splice(index, 1)[0];
    clearInterval(removedSite.intervalId);
    siteTreeDataProvider.refresh();
  }
}

const stopMonitoringCommand = vscode.commands.registerCommand('site-monitor.stopMonitoring', (site: Site) => {
  stopMonitoringSite(site);
});

function stopMonitoringSite(site: Site) {
  const index = sites.findIndex((s) => s.url === site.url);

  if (index !== -1) {
    const stoppedSite = sites.splice(index, 1)[0];
    clearInterval(stoppedSite.intervalId);
    siteTreeDataProvider.refresh();
  }
}

export function deactivate() {}
