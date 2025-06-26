import {
  BulkIssueMoveRequestData,
  ProjectIssueTypClassification,
  TargetClassification,
  TargetMandatoryField
} from "../types/BulkIssueMoveRequestData";

export class BulkIssueMoveRequestDataBuilder {

  private bulkIssueMoveRequestData: BulkIssueMoveRequestData = {
    sendBulkNotification: false,
    targetToSourcesMapping: {}
  }

  addMapping = (destinationProjectIdOrKey: string, destinationIssueTypeId: string, destinationParentKeyOrId: string, classification: ProjectIssueTypClassification): BulkIssueMoveRequestDataBuilder => {
    const projectAndIssueTypeKey = destinationParentKeyOrId ? 
      `${destinationProjectIdOrKey},${destinationIssueTypeId},${destinationParentKeyOrId}` :
      `${destinationProjectIdOrKey},${destinationIssueTypeId}`;
    this.bulkIssueMoveRequestData.targetToSourcesMapping[projectAndIssueTypeKey] = classification;
    return this;
  }

  setSendBulkNotification = (sendBulkNotification: boolean): BulkIssueMoveRequestDataBuilder => {
    this.bulkIssueMoveRequestData.sendBulkNotification = sendBulkNotification;
    return this;
  }

  build = (): BulkIssueMoveRequestData => {
    return this.bulkIssueMoveRequestData;
  }

}

export class TargetMandatoryFieldBuilder {

  targetMandatoryFields: TargetMandatoryField[] = [];

  addField = (fieldName: string, fieldValue: any): TargetMandatoryFieldBuilder => {
    let fields: any = undefined;
    if (this.targetMandatoryFields.length === 0) {
      fields = {};
      const targetMandatoryField: TargetMandatoryField = {
        fields: fields
      }
      this.targetMandatoryFields.push(targetMandatoryField);
    } else {
      fields = this.targetMandatoryFields[0].fields;
    }
    fields[fieldName] = fieldValue;
    return this;
  }

  build = (): TargetMandatoryField[] => {
    return this.targetMandatoryFields;
  }

}

export class ProjectIssueTypeClassificationBuilder {

  classification: ProjectIssueTypClassification = {
    inferClassificationDefaults: true,
    inferFieldDefaults: true,
    inferStatusDefaults: true,
    inferSubtaskTypeDefault: true,
    issueIdsOrKeys: [],
    targetMandatoryFields: [],
  };

  addIssueIdOrKey = (issueIdOrKey: string): ProjectIssueTypeClassificationBuilder => {
    this.classification.issueIdsOrKeys.push(issueIdOrKey);
    return this;
  }

  setInferClassificationDefaults = (inferClassificationDefaults: boolean): ProjectIssueTypeClassificationBuilder => {
    this.classification.inferClassificationDefaults = inferClassificationDefaults;
    return this;
  }

  setInferFieldDefaults = (inferFieldDefaults: boolean): ProjectIssueTypeClassificationBuilder => {
    this.classification.inferFieldDefaults = inferFieldDefaults;
    return this;
  }

  setInferStatusDefaults = (inferStatusDefaults: boolean): ProjectIssueTypeClassificationBuilder => {
    this.classification.inferStatusDefaults = inferStatusDefaults;
    return this;
  }

  setInferSubtaskTypeDefault = (inferSubtaskTypeDefault: boolean): ProjectIssueTypeClassificationBuilder => {
    this.classification.inferSubtaskTypeDefault = inferSubtaskTypeDefault;
    return this;
  }

  setTargetClassification = (targetClassification: TargetClassification[]): ProjectIssueTypeClassificationBuilder => {
    this.classification.targetClassification = targetClassification;
    return this;
  }

  setTargetMandatoryFields = (targetMandatoryFields: TargetMandatoryField[]): ProjectIssueTypeClassificationBuilder => {
    this.classification.targetMandatoryFields = targetMandatoryFields;
    return this;
  }

  addTargetMandatoryField = (fieldName, fieldValue: any): ProjectIssueTypeClassificationBuilder => {
    let fields: any = undefined;
    if (this.classification.targetMandatoryFields.length === 0) {
      fields = {};
      const targetMandatoryField: TargetMandatoryField = {
        fields: fields
      }
      this.classification.targetMandatoryFields.push(targetMandatoryField);
    } else {
      fields = this.classification.targetMandatoryFields[0].fields;
    }
    fields[fieldName] = fieldValue;
    return this;
  }

  build = (): ProjectIssueTypClassification => {
    const clonedClassification = JSON.parse(JSON.stringify(this.classification)); // Deep clone to avoid mutation
    if (clonedClassification.targetMandatoryFields) {
     if (clonedClassification.targetMandatoryFields.length === 0) {
        clonedClassification.inferFieldDefaults = true; // No target mandatory fields are set so infer field defaults
        delete clonedClassification.targetMandatoryFields; // Remove targetMandatoryFields since it is empty
      } else {
        console.warn(` * ProjectIssueTypeClassificationBuilder: changing inferFieldDefaults to false since targetMandatoryFields are set...`);
        clonedClassification.inferFieldDefaults = false;
      }
    } else {
      clonedClassification.inferFieldDefaults = true; // No target mandatory fields are set so infer field defaults
    }


    // Test
    // "customfield_10091": {
    //   "retain": true,
    //   "type": "raw",
    //   "value": [
    //     "10020"
    //   ]
    // },


    return clonedClassification;
  }
  
}