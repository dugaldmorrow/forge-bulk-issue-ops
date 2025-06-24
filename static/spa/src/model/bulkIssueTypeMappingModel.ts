// import ListenerGroup from "src/model/ListenerGroup";

import { Issue } from "../types/Issue";

class bulkIssueTypeMappingModel {

  // private listenerGroup = new ListenerGroup('bulkIssueTypeMappingModel');
  private sourceToTargetIssueTypeIds = new Map<string, string>();

  areAllIssueTypesMapped = (issues: Issue[]): boolean => {
    // console.log(`bulkIssueTypeMappingModel: computing is all issue types are mapped based on selected issues = ${issues.map(issue => issue.key).join(', ')}`);
    for (const issue of issues) {
      const targetIssueTypeId = this.getTargetIssueTypeId(issue.fields.project.id, issue.fields.issuetype.id);
      if (!targetIssueTypeId) {
        return false;
      }
    }
    return true;
  }

  addMapping = (sourceProjectId: string, sourceIssueTypeId: string, targetIssueTypeId: string): void => {
    // console.log(`bulkIssueTypeMappingModelModel.addMapping: (${sourceProjectId}, ${sourceIssueTypeId}) -> ${targetIssueTypeId}`);
    const key = this.buildKey(sourceProjectId, sourceIssueTypeId);
    this.sourceToTargetIssueTypeIds.set(key, targetIssueTypeId);
    // this.notifyListeners();
  }

  getTargetIssueTypeId = (sourceProjectId: string, sourceIssueTypeId: string): string | undefined => {
    const key = this.buildKey(sourceProjectId, sourceIssueTypeId);
    return this.sourceToTargetIssueTypeIds.get(key);
  }

  cloneSourceToTargetIssueTypeIds = (): Map<string, string> => {
    // console.log('Cloning sourceToTargetIssueTypeIds map from bulkIssueTypeMapping');
    const originalSourceToTargetIssueTypeIds = this.sourceToTargetIssueTypeIds;
    const clonedMap = new Map<string, string>();
    originalSourceToTargetIssueTypeIds.forEach((value, key) => {
      // console.log(` * Cloning mapping: ${key} -> ${value}`);
      clonedMap.set(key, value);
    });
    return clonedMap;
  }

  private buildKey = (sourceProjectId: string, sourceIssueTypeId: string): string => {
    return `${sourceProjectId},${sourceIssueTypeId}`;
  }

  // registerListener = (listener: any) => {
  //   this.listenerGroup.registerListener(listener);
  // };

  // unregisterListener = (listener: any) => {
  //   this.listenerGroup.unregisterListener(listener);
  // };

  // private notifyListeners = () => {
  //   this.listenerGroup.notifyListeners(undefined);
  // };

}

export default new bulkIssueTypeMappingModel();
