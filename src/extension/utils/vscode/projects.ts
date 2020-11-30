import * as path from "path";
import * as vs from "vscode";
import { Uri } from "vscode";
import { Logger } from "../../../shared/interfaces";
import { flatMap, notUndefined } from "../../../shared/utils";
import { findProjectFolders, fsPath } from "../../../shared/utils/fs";
import { getDartWorkspaceFolders } from "../../../shared/vscode/utils";
import { locateBestProjectRoot } from "../../project";
import { getExcludedFolders, homeRelativePath, isFlutterProjectFolder } from "../../utils";

export async function getFolderToRunCommandIn(logger: Logger, placeHolder: string, selection?: vs.Uri, flutterOnly = false): Promise<string | undefined> {
	// Attempt to find a project based on the supplied folder of active file.
	let file = selection && fsPath(selection);
	file = file || (vs.window.activeTextEditor && fsPath(vs.window.activeTextEditor.document.uri));
	const folder = file && locateBestProjectRoot(file);

	if (folder)
		return folder;

	// Otherwise look for what projects we have.
	const workspaceFolders = getDartWorkspaceFolders();
	const topLevelFolders = workspaceFolders.map((w) => fsPath(w.uri));
	const allExcludedFolders = flatMap(workspaceFolders, getExcludedFolders);
	const selectableFolders = (await findProjectFolders(logger, topLevelFolders, allExcludedFolders, { requirePubspec: true, sort: true }))
		.filter(flutterOnly ? isFlutterProjectFolder : () => true);

	if (!selectableFolders || !selectableFolders.length) {
		const projectTypes = flutterOnly ? "Flutter" : "Dart/Flutter";
		vs.window.showWarningMessage(`No ${projectTypes} projects were found.`);
		return undefined;
	}

	return showFolderPicker(selectableFolders, placeHolder); // TODO: What if the user didn't pick anything?
}

async function showFolderPicker(folders: string[], placeHolder: string): Promise<string | undefined> {
	// No point asking the user if there's only one.
	if (folders.length === 1) {
		return folders[0];
	}

	const items = folders.map((f) => {
		const workspaceFolder = vs.workspace.getWorkspaceFolder(Uri.file(f));
		if (!workspaceFolder)
			return undefined;

		const workspacePathParent = path.dirname(fsPath(workspaceFolder.uri));
		return {
			description: homeRelativePath(workspacePathParent),
			label: path.relative(workspacePathParent, f),
			path: f,
		} as vs.QuickPickItem & { path: string };
	}).filter(notUndefined);

	const selectedFolder = await vs.window.showQuickPick(items, { placeHolder });
	return selectedFolder && selectedFolder.path;
}
