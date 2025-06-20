import { IssueBulkEditField } from "src/types/IssueBulkEditFieldApiResponse";
import { allowBulkMovesAcrossProjectCategories, allowTheTargetProjectToMatchAnyIssueSourceProject } from "../extension/bulkOperationStaticRules";
import { Issue } from "../types/Issue";
import { Project } from "../types/Project";
import { OperationOutcome } from "src/types/OperationOutcome";
import { ObjectMapping } from "src/types/ObjectMapping";
import { buildErrorOutcome, buildSuccessOutcome } from "../controller/OperationOutcomeBuilder";
import { FieldEditValue } from "src/types/FieldEditValue";
import { ProjectCategory } from "src/types/ProjectCategory";
import jiraDataModel from "src/model/jiraDataModel";
import jiraUtil from "src/controller/jiraUtil";
import { IssueType } from "src/types/IssueType";
import { filterEditFieldsImplementation } from "./filterEditFieldsImplementationTemplate";
import { BulkOperationMode } from "src/types/BulkOperationMode";

class BulkOperationRuleEnforcer {

  private excludedProjectKeys = new Set<string>()
    // Just examples, you can add more project keys to exclude.
    .add('FIXED')
    .add('DUMMY');

  /**
   * This function validates the value of a field against its validation rules.
   * @param field The field to validate.
   * @param value The proposed value of the field. This is the value to validate.
   * @param fieldIdsToFields An object that maps field IDs to their corresponding IssueBulkEditField objects.
   * @param otherEditedFieldIdsToValues An object that maps field IDs to their values that are being bulk
   * edited. This is useful when there is a need to validate a field against the values of other fields such as
   * when a field is required only if another field has a certain value or if a field value must relate to
   * another field value (e.g. start date < end date).
   * @returns An OperationOutcome indicating the result of the validation.
   */
  public validateFieldValue = async (
      field: IssueBulkEditField,
      value: FieldEditValue,
      fieldIdsToFields: ObjectMapping<IssueBulkEditField>,
      otherEditedFieldIdsToValues: ObjectMapping<FieldEditValue>
  ): Promise<OperationOutcome> => {
    // console.log(`bulkOperationRuleEnforcer.validateFieldValue: field = ${field.name}, value = ${value}`);

    // See exampleValidateEndDateFieldValue at the bottom of this class for an example of how to validate
    // a field in relation to other fields.

    // To return a failed validation, start with the following code;
    // return buildErrorOutcome(`Demo erroroneous field validation for field "${field.name}" with value ${value}`);

    return buildSuccessOutcome();
  }

  /**
   * This function is invoked when the user selects a source project to move issues from. The users starts
   * typing the name or key of the source project which results in a Jira API call to retrieve a set of matching
   * projects which is then passed to this function for filtering.
   * @param selectedSourceProjects 
   * @returns the filtered source projects that are allowed to be selected as the source project for the bulk move operation.
   */
  public filterSourceProjects = async (
    selectedSourceProjects: Project[],
    bulkOperationMode: BulkOperationMode
  ): Promise<Project[]> => {
    // console.log(`bulkOperationRuleEnforcer.filterSourceProjects: selectedSourceProjects = ${selectedSourceProjects.map(project => project.name).join(', ')}`);
    const filteredProjects = selectedSourceProjects.filter((project: Project) => {
      return !this.excludedProjectKeys.has(project.key);
    });
    return filteredProjects;
  }

  /**
   * This method allows the selectable issue types in the originating project(s) to be filtered.
   * @param issueTypes all the issues types for the selected source project(s)
   * @param projects the source projects that the issues are being moved from
   * @param bulkOperationMode the current bulk operations mode, e.g. 'move' or 'edit'
   * @returns the filtered issue types. 
   */
  public filterSourceProjectIssueTypes = async(
    issueTypes: IssueType[],
    projects: Project[],
    bulkOperationMode: BulkOperationMode
  ): Promise<IssueType[]> => {
    // console.log(`bulkOperationRuleEnforcer.filterSourceProjectIssueTypes: issueTypes = ${issueTypes.map(issueType => issueType.name).join(', ')}`);
    // console.log(`bulkOperationRuleEnforcer.filterSourceProjectIssueTypes: projects = ${projects.map(project => project.name).join(', ')}`);

    return issueTypes;
  };

  /**
   * Filters the issue types that are allowed to be mapped to in the bulk move operation.
   * @param issueTypes The issue types to filter.
   * @param targetProject The target project for the bulk edit operation.
   * @returns The filtered issue types that are allowed to be selected as the target issue type.
   */
  public filterIssueTypes = (
    issueTypes: IssueType[],
    targetProject: Project,
    bulkOperationMode: BulkOperationMode
  ): IssueType[] => {
    // console.log(`bulkOperationRuleEnforcer.filterIssueTypes: issueTypes = ${issueTypes.map(issueType => issueType.name).join(', ')}`);
    return issueTypes.filter(issueType => {
      // Apply your filtering logic here

      // The following is a simple example to avoid changing parenting of issues by identifying 
      // issue types based on their names. It would be more robust to use the issue type IDs.
      if (issueType.name === 'Epic' || issueType.name === 'Sub-task') {
        return false;
      }

      return true;
    });
  }

  /**
   * Filters the fields that are allowed to be edited in the bulk edit operation.
   * @param fields The fields to filter.
   * @returns the filtered fields that are allowed to be edited in the bulk edit operation.
   */
  public filterEditFields = async (
    fields: IssueBulkEditField[],
    issueTypes: IssueType[],
    // selectedProjects: Project[]
  ): Promise<IssueBulkEditField[]> => {
    // console.log(`bulkOperationRuleEnforcer.filterEditFields: fields = ${fields.map(field => field.name).join(', ')}`);
    const filteredFields = fields.filter(field => {
      if (field.id === 'reporter') {
        // It is assummed that the reporter field is not editable.
        return false;
      }
      return true;
    });
    return filteredFields;

    // return filterEditFieldsImplementation(fields, issueTypes);
  }

  /**
   * This function is invoked when the user selects a target project to moving issues to. The users starts
   * typing the name or key of the target project which results in a Jira API call to retrieve a set of matching
   * projects which is then passed to this function for filtering.
   * @param selectedIssuesToMove 
   * @param candidateTargetProjects 
   * @returns 
   */
  public filterTargetProjects = async (
    issuesToMove: Issue[],
    candidateProjects: Project[]
  ): Promise<Project[]> => {
    // console.log(`bulkOperationRuleEnforcer: filterTargetProjects: issuesToMove = ${issuesToMove.map(issue => issue.key).join(', ')}, candidateProjects = ${candidateProjects.map(project => project.key).join(', ')}`);
    let filteredProjects: Project[] = candidateProjects;
    if (!allowBulkMovesAcrossProjectCategories) {
      filteredProjects = await this.filterCrossCategoryMoves(issuesToMove, filteredProjects);
    }
    if (!allowTheTargetProjectToMatchAnyIssueSourceProject) {
      filteredProjects = this.filterIssuesToMoveProjectsFromTargetProjects(issuesToMove, filteredProjects);
    }
    // console.log(` * returning filteredProjects = ${filteredProjects.map(project => project.key).join(', ')}`);
    return filteredProjects;
  }

  private filterCrossCategoryMoves = async (
    issuesToMove: Issue[],
    candidateTargetProjects: Project[]
  ): Promise<Project[]> => {
    // console.log(`bulkOperationRuleEnforcer.filterCrossCategoryMoves...`);
    const filteredProjectKeysToProjects = new Map<string, Project>();
    for (const candidateTargetProject of candidateTargetProjects) {
      filteredProjectKeysToProjects.set(candidateTargetProject.key, candidateTargetProject);
    }
    const issueProjectCategoryIdsToCategories = new Map<string, ProjectCategory>();
    for (const issueToMove of issuesToMove) {
      const candidateProject: Project = candidateTargetProjects.find((project: Project) => {
        return issueToMove.key.startsWith(`${project.key}-`);
      });
      if (candidateProject) {
        const issueProjectInvocationResult = await jiraDataModel.getProjectByIdOrKey(issueToMove.fields.project.key);
        if (issueProjectInvocationResult.ok) {
          const issueProject = issueProjectInvocationResult.data;
          const issueProjectCategory = issueProject.projectCategory;
          if (issueProjectCategory) {
            issueProjectCategoryIdsToCategories.set(issueProjectCategory.id, issueProjectCategory);
          } else {

          }
          const sameProjectCategories = jiraUtil.areSameProjectCategories(issueProjectCategory, candidateProject.projectCategory);
          // console.log(` * sameProjectCategories ${sameProjectCategories} for issue ${issueToMove.key}.`);
          if (sameProjectCategories) {
            // Do nothing
          } else {
            // The issue to move is not in the same project category as the candidate project, so remove the 
            // project from the filter set.
            filteredProjectKeysToProjects.delete(issueToMove.fields.project.key);
          }
        } else {
          console.warn(` * project with key ${issueToMove.fields.project.key} not found.`);
        }
      } else {
        // console.log(` * no candidate project found for issue ${issueToMove.key}.`);
      }
    }

    if (issueProjectCategoryIdsToCategories.size === 0) {
      // console.log(` * no issue project categories found, returning no target projects.`);
      // return [];
    } else if (issueProjectCategoryIdsToCategories.size === 1) {
      issueProjectCategoryIdsToCategories.forEach((issueProjectCategory: ProjectCategory, issueProjectCategoryId: string) => {
        for (const candidateTargetProject of candidateTargetProjects) {
          const sameProjectCategories = jiraUtil.areSameProjectCategories(issueProjectCategory, candidateTargetProject.projectCategory);
          // console.log(` * sameProjectCategories ${sameProjectCategories} for issueProjectCategory ${issueProjectCategory.name}.`);
          if (sameProjectCategories) {
            // Do nothing
          } else {
            // The issue to move is not in the same project category as the candidate project, so remove the 
            // project from the filter set.
            filteredProjectKeysToProjects.delete(candidateTargetProject.key);
          }
        }
      });
    } else {
      // console.log(` * multiple issue project categories found, returning no target projects.`);
      return [];
    }

    const issueProjectCategories = Array.from(issueProjectCategoryIdsToCategories.values());

    const filteredProjects: Project[] = Array.from(filteredProjectKeysToProjects.values());
    return filteredProjects;
  }

  private filterIssuesToMoveProjectsFromTargetProjects = (
    issuesToMove: Issue[],
    candidateTargetProjects: Project[]
  ): Project[] => {
    const filteredProjectKeysToProjects = new Map<string, Project>();
    for (const candidateTargetProject of candidateTargetProjects) {
      filteredProjectKeysToProjects.set(candidateTargetProject.key, candidateTargetProject);
    }
    for (const issueToMove of issuesToMove) {
      const candidateTargetProject: Project = candidateTargetProjects.find((project: Project) => {
        return issueToMove.key.startsWith(`${project.key}-`);
      });
      if (candidateTargetProject) {
        // The issue to move is in the set of candidate projects, so remove the project from the filter set.
        filteredProjectKeysToProjects.delete(issueToMove.key.split('-')[0]);
      }
    }
    const filteredProjects: Project[] = Array.from(filteredProjectKeysToProjects.values());
    return filteredProjects;
  }

  private isIssueInProjectCategory = (issue: Issue, projectCategory: ProjectCategory): boolean => {
    return issue.fields.project.projectCategory?.id === projectCategory.id;
  }

  private exampleValidateEndDateFieldValue = async (
      field: IssueBulkEditField,
      value: FieldEditValue,
      fieldIdsToFields: ObjectMapping<IssueBulkEditField>,
      otherEditedFieldIdsToValues: ObjectMapping<FieldEditValue>
  ): Promise<OperationOutcome> => {
    if (field.name === 'Actual end') {
      const actualStart = this.findFieldValueByName('Actual start', fieldIdsToFields, otherEditedFieldIdsToValues);
      if (actualStart) {
        const actualEndDate = new Date(value.value);
        const actualStartDate = new Date(actualStart.value);
        if (actualEndDate < actualStartDate) {
          return buildErrorOutcome(`The field "${field.name} (${actualEndDate.toLocaleDateString()})" must be after the value of the field "Actual start (${actualStartDate.toLocaleDateString()})".`);
        } else {
          return buildSuccessOutcome();
        }
      } else {
        return buildErrorOutcome(`The field "Actual start" is required when the field "${field.name}" is set.`);
      }
    }
  }

  private findFieldValueByName = (name: string, fieldIdsToFields: ObjectMapping<any>, fieldIdsToValues: ObjectMapping<any>): any | undefined => {
    const fieldIds = Object.keys(fieldIdsToFields);
    for (const fieldId of fieldIds) {
      const field: IssueBulkEditField = fieldIdsToFields[fieldId];
      if (field.name === name) {
        return fieldIdsToValues[fieldId];
      }
    }
    return undefined;
  }

}

export default new BulkOperationRuleEnforcer();
