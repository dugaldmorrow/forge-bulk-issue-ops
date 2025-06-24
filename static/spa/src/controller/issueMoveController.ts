import { TaskOutcome, TaskStatus } from "../types/TaskOutcome";
import { BulkIssueMoveRequestDataBuilder, ProjectIssueTypeClassificationBuilder } from "./BulkIssueMoveRequestDataBuilder";
import { IssueMoveEditRequestOutcome, OutcomeError } from "../types/IssueMoveRequestOutcome";
import { IssueType } from "../types/IssueType";
import { Issue } from "../types/Issue";
import jiraDataModel from "../model/jiraDataModel";
import { TargetMandatoryFields } from "../types/TargetMandatoryField";
import { InvocationResult } from "../types/InvocationResult";
import bulkIssueTypeMappingModel from "../model/bulkIssueTypeMappingModel";
import { ObjectMapping } from "src/types/ObjectMapping";

const issueMovePollPeriodMillis = 1000;

class IssueMoveController {

  initiateMove = async (
    destinationProjectId: string,
    issues: Issue[],
    targetIssueTypeIdsToTargetMandatoryFields: Map<string, TargetMandatoryFields>,
    sendBulkNotification: boolean,
  ): Promise<IssueMoveEditRequestOutcome> => {
    const allProjectsSearchInfo = await jiraDataModel.pageOfProjectSearchInfo('');
    const issueTypesInvocationResult: InvocationResult<IssueType[]> = await jiraDataModel.getIssueTypes();
    if (!issueTypesInvocationResult.ok) {
      await this.delay(2000);
      return await this.initiateMove(destinationProjectId, issues, targetIssueTypeIdsToTargetMandatoryFields, sendBulkNotification);
    }

    const allIssueTypes: IssueType[] = issueTypesInvocationResult.data;
    let destinationProject = allProjectsSearchInfo.values.find(project => project.id === destinationProjectId);
    if (!destinationProject) {
      const destinationProjectInvocationResult = await jiraDataModel.getProjectByIdOrKey(destinationProjectId);
      if (destinationProjectInvocationResult.ok) {
        destinationProject = destinationProjectInvocationResult.data;
      } else {
        console.warn(` * Failed to find destination project with ID ${destinationProjectId}: ${destinationProjectInvocationResult.errorMessage}`);
      }
    }
    if (destinationProject) {
      const bulkIssueMoveRequestDataBuilder = new BulkIssueMoveRequestDataBuilder();
      const projectIssueTypeKeysToBuilders = new Map<string, ProjectIssueTypeClassificationBuilder>();

      // Step 1: Arrange issues into arrays by target issue type
      const sourceIssueTypeIdsToTargetIssueTypes = new Map<string, IssueType>();
      // const sourceIssueTypeIdsToSourceIssues = new Map<string, Issue[]>();
      const targetIssueTypeIdsToSourceIssues = new Map<string, Issue[]>();
      for (const issue of issues) {
        const sourceProjectId = issue.fields.project.id;
        const sourceIssueTypeId = issue.fields.issuetype.id;
        const targetIssueTypeId = bulkIssueTypeMappingModel.getTargetIssueTypeId(sourceProjectId, sourceIssueTypeId);
        if (targetIssueTypeId) {
          const targetIssueType = allIssueTypes.find(issueType => issueType.id === targetIssueTypeId);
          sourceIssueTypeIdsToTargetIssueTypes.set(sourceIssueTypeId, targetIssueType);

          const targetMandatoryFields = targetIssueTypeIdsToTargetMandatoryFields.get(targetIssueTypeId);
          if (targetMandatoryFields) {
            targetIssueTypeIdsToTargetMandatoryFields.set(targetIssueTypeId, targetMandatoryFields);
          } else {
            throw new Error(`Internal error: no target mandatory fields found for source issue type ${sourceIssueTypeId}`);
          }

          const issuesOfType = targetIssueTypeIdsToSourceIssues.get(targetIssueTypeId);
          if (issuesOfType) {
            issuesOfType.push(issue);
          } else {
            targetIssueTypeIdsToSourceIssues.set(targetIssueTypeId, [issue]);
          }
        } else {
          throw new Error(`Internal error: a target issue type was not found for projectId ${sourceProjectId} and source issueTypeId ${sourceIssueTypeId}`);
        }
      }

      // Step 2: Iterate over issue types so that all issues of the same type are dealt with together since this
      //         is how the bulk move API payload needs to be formatted.
      const issueIdsToIssuesAddedToRequest: ObjectMapping<Issue> = {};
      const targetIssueTypes: IssueType[] = Array.from(sourceIssueTypeIdsToTargetIssueTypes.values());
      for (const targetIssueType of targetIssueTypes) {
        const issuesOfType = targetIssueTypeIdsToSourceIssues.get(targetIssueType.id);
        if (issuesOfType) {
          const projectIssueTypeKey = `${destinationProject.id}-${targetIssueType.id}`;
          const projectIssueTypeClassificationBuilder = new ProjectIssueTypeClassificationBuilder()
            .setInferClassificationDefaults(true)
            .setInferFieldDefaults(true)
            .setInferStatusDefaults(true)
            .setInferSubtaskTypeDefault(true)
            .setTargetClassification([])
            .setTargetMandatoryFields([]);
          for (const issueOfType of issuesOfType) {
            const issueAlreadyAdded = issueIdsToIssuesAddedToRequest[issueOfType.id];
            if (issueAlreadyAdded) {
              console.warn(` * Issue with ID ${issueOfType.id} already added to the request. Skipping.`);
            } else {
              projectIssueTypeClassificationBuilder.addIssueIdOrKey(issueOfType.id);
              issueIdsToIssuesAddedToRequest[issueOfType.id] = issueOfType;
            }
          }
          const targetMandatoryFields: TargetMandatoryFields = targetIssueTypeIdsToTargetMandatoryFields.get(
            targetIssueType.id);
          const targetMandatoryFieldsCount = targetMandatoryFields ? Object.keys(targetMandatoryFields.fields).length : 0;
          if (targetMandatoryFieldsCount > 0) {
            projectIssueTypeClassificationBuilder
              .setInferFieldDefaults(false)
              .setTargetMandatoryFields([targetMandatoryFields]);
          }
          projectIssueTypeKeysToBuilders.set(projectIssueTypeKey, projectIssueTypeClassificationBuilder);
            bulkIssueMoveRequestDataBuilder.addMapping(
              destinationProject.id,
              targetIssueType.id,
              projectIssueTypeClassificationBuilder.build()
          );
        } else {
          throw new Error(`Internal error: no issues found for issue type ${targetIssueType.id}`);
        }
      }
      const issueIdsAdded = Object.keys(issueIdsToIssuesAddedToRequest);
      console.log(` * Added ${issueIdsAdded.length} issues to the bulk move request: ${issueIdsAdded.join(', ')}`);

      // Step 3: Build the bulk issue move request data
      bulkIssueMoveRequestDataBuilder.setSendBulkNotification(sendBulkNotification);
      const bulkIssueMoveRequestData = bulkIssueMoveRequestDataBuilder.build();
      console.log(` * bulkIssueMoveRequestData: ${JSON.stringify(bulkIssueMoveRequestData, null, 2)}`);

      // Step 4: Initiate the bulk issue move request
      const invocationResult: InvocationResult<IssueMoveEditRequestOutcome> = await jiraDataModel.initiateBulkIssuesMove(bulkIssueMoveRequestData);
      if (invocationResult.ok && invocationResult.data) {
        const requestOutcome: IssueMoveEditRequestOutcome = invocationResult.data;
        if (requestOutcome.taskId) {
          console.log(` * Initiated bulk issue move with taskId: ${requestOutcome.taskId}`);
        } else {
          console.warn(` * Initiation of bulk move request resulted in an error: ${requestOutcome.errors}`);
        }

        // Step 5: Before returning, invalidate cached issue keys
        await jiraDataModel.invalidateCachedIssueKeys();

        return requestOutcome;
      } else {
        console.warn(` * Initiation of bulk move request resulted in an API error: ${invocationResult.errorMessage}`);
        const errors: OutcomeError[] = [{
          message: invocationResult.errorMessage,
        }];
        const requestOutcome: IssueMoveEditRequestOutcome = {
          taskId: undefined,
          errors: invocationResult.errorMessage ? errors : [],
          statusCode: 500
        }
        return requestOutcome;
      }
    } else {
      console.log(`Dumping all projects search info: `);
      for (const project of allProjectsSearchInfo.values) {
        console.log(` * Project: ${project.id} = ${project.name} (${project.key})`);
      }
      throw new Error(`Destination project ${destinationProjectId} not found`);
    }
  }

  pollMoveProgress = async (taskId: string): Promise<TaskOutcome> => {
    const params = {
      taskId: taskId,
    }
    const issueMoveOutcome = await jiraDataModel.getTaskOutcome(taskId);
    return issueMoveOutcome;
  }

  awaitMoveCompletion = async (invoke: any, taskId: string): Promise<TaskOutcome> => {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        const issueMoveOutcome = await this.pollMoveProgress(taskId);
        if (issueMoveOutcome) {
          // console.log(` * Found issueMoveOutcome for taskId ${taskId}`);
          resolve(issueMoveOutcome);
        } else {
          // console.log(` * Did not find issueMoveOutcome for taskId ${taskId}`);
          const outcome = await this.awaitMoveCompletion(invoke, taskId);
          resolve(outcome);
        }
      }, issueMovePollPeriodMillis);
    });
  }

  isDone = (status: TaskStatus): boolean => {
    if (status === 'ENQUEUED' || status === 'RUNNING') {
      return false;
    } else if (status === 'COMPLETE' || status === 'FAILED' || status === 'CANCEL_REQUESTED' || status === 'CANCELLED' || status === 'DEAD') {
      return true;
    } else {
      return false;
    }
  }

  private delay = (milliseconds: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

}

export default new IssueMoveController();
