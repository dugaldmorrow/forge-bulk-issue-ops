import jiraDataModel from "../model/jiraDataModel";
import { DataRetrievalResponse } from "../types/DataRetrievalResponse";
import { DataRetrievalResponseBuilder } from "../model/DataRetrievalResponseBuilder";
import { Project } from "../types/Project";
import { IssueTypeFieldMappings, ProjectFieldMappings } from "../types/ProjectFieldMappings";
import { FieldMappingInfo } from "src/types/FieldMappingInfo";
import { optionalFieldNamesToIncludeInMoves } from "src/extension/bulkOperationStaticRules";

export const buildFieldMappingsForProject = async (
  targetProjectId: string,
  onlyIncludeCustomFields: boolean,
  onlyIncludeRequiredFields: boolean
): Promise<DataRetrievalResponse<ProjectFieldMappings>> => {
  const projectFieldMappings: ProjectFieldMappings = {
    targetIssueTypeIdsToMappings: new Map<string, IssueTypeFieldMappings>()
  }
  const projectCreateIssueMetadata = await jiraDataModel.getCreateIssueMetadataForProject(targetProjectId);
  // console.log(`buildFieldMappingsForProject: projectCreateIssueMetadata: ${JSON.stringify(projectCreateIssueMetadata, null, 2)}`);
  // const projectId = projectCreateIssueMetadata.id;
  // console.log(`Found ${projectCreateIssueMetadata.issuetypes.length} issue types for project ${targetProjectId}`);
  for (const targetIssueType of projectCreateIssueMetadata.issuetypes) {
    // console.log(` * buildFieldMappingsForProject: Processing issue type: ${targetIssueType.name} (${targetIssueType.id})`);
    const fieldIdsToFieldMappingInfos = new Map<string, FieldMappingInfo>();
    const issueTypeFieldMappings: IssueTypeFieldMappings = {
      fieldIdsToFieldMappingInfos: fieldIdsToFieldMappingInfos
    };
    projectFieldMappings.targetIssueTypeIdsToMappings.set(targetIssueType.id, issueTypeFieldMappings);
    // console.log(` * buildFieldMappingsForProject: targetIssueTypesToMappings.set: ${targetIssueType.id} (${targetIssueType.name})`);

    for (const fieldId in targetIssueType.fields) {
      const field = targetIssueType.fields[fieldId];
      const includeField = !onlyIncludeRequiredFields || field.required;
      if (includeField) {
        const isCustomField = !onlyIncludeCustomFields || field.schema && field.schema.customId;
        if (isCustomField) {
          // console.log(`buildFieldMappingsForProject: Found custom field: ${fieldId} (required = ${field.required}, schema type = ${field.schema.type})`);

          // if (fieldId === "customfield_10091") {
          //   console.log(` ***** buildFieldMappingsForProject: Found R2D2 Team field (customfield_10091)`);
          // }

          // if (fieldId === "customfield_10124") {
          //   console.log(` ***** buildFieldMappingsForProject: Found My Number field (customfield_10124)`);
          // }

          const fieldMappingInfo: FieldMappingInfo = {
            fieldId: fieldId,
            fieldMetadata: field,
          }
          issueTypeFieldMappings.fieldIdsToFieldMappingInfos.set(fieldId, fieldMappingInfo);
        } else {
          // console.log(`buildFieldMappingsForProject: Skipping non-custom field: ${field.name}`);
        }
      } else {
        if (optionalFieldNamesToIncludeInMoves.includes(field.name)) {
          console.log(`buildFieldMappingsForProject: Adding optional field "${field.name}" as per configuration.`);
          const fieldMappingInfo: FieldMappingInfo = {
            fieldId: fieldId,
            fieldMetadata: field,
          }
          issueTypeFieldMappings.fieldIdsToFieldMappingInfos.set(fieldId, fieldMappingInfo);
        } else {
          // console.log(`buildFieldMappingsForProject: Skipping optional field: ${field.name}`);
        }
      }
    }
  }
  return new DataRetrievalResponseBuilder<ProjectFieldMappings>()
    .setData(projectFieldMappings)
    .build();
}
