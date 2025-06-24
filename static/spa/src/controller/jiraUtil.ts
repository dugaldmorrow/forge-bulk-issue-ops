import { Issue } from "src/types/Issue";
import { IssueType } from "../types/IssueType";
import { Project } from "../types/Project";
import { ProjectCategory } from "src/types/ProjectCategory";
import { ObjectMapping } from "src/types/ObjectMapping";
import { IssueBulkEditField } from "src/types/IssueBulkEditFieldApiResponse";

class JiraUtil {

  deduplicateIssueTypes(selectableIssueTypes: IssueType[]) {
    const uniqueIssueTypes = new Map<string, IssueType>();
    for (const issueType of selectableIssueTypes) {
      uniqueIssueTypes.set(issueType.id, issueType);
    }
    return Array.from(uniqueIssueTypes.values());
  }

  areSameProjectCategories = (projectCategoryA: undefined | ProjectCategory, projectCategoryB: undefined | ProjectCategory) => {
    if (projectCategoryA && projectCategoryB) {
      return projectCategoryA.id === projectCategoryB.id;
    } else {
      // If either project category is undefined, they are deemed not the same since they are effectively in unique 
      // undefined project categories.
      return false;
    }
  }

  countIssueTypesByIssues = (issues: Issue[]) => {
    const issueTypeIds = new Set<string>();
    for (const issue of issues) {
      if (issue.fields.issuetype) {
        issueTypeIds.add(issue.fields.issuetype.id);
      }
    }
    return issueTypeIds.size;
  }

  getIssuesWithSubtasks = (issues: Issue[]): Issue[] => {
    const issuesWithSubtasks: Issue[] = [];
    for (const issue of issues) {
      if (issue.fields.subtasks && issue.fields.subtasks.length > 0) {
        issuesWithSubtasks.push(issue);
      }
    }
    return issuesWithSubtasks;
  }

  countProjectsByIssues = (issues: Issue[]) => {
    const projectKeys = new Set<string>();
    for (const issue of issues) {
      if (issue.fields.project) {
        projectKeys.add(issue.fields.project.key);
      } else {
        const issueKey = issue.key;
        const projectKey = issueKey.split('-')[0];
        projectKeys.add(projectKey);
      }
    }
    return projectKeys.size;
  }

  filterProjectsIssueTypes = (projects: Project[]): IssueType[] => {
    // console.log(`JiraUtil.filterProjectsIssueTypes: projects: ${JSON.stringify(projects, null, 2)}`);
    const filteredIssueTypes = new Set<IssueType>();
    // const isTeamManagedProject = project.simplified;
    for (const project of projects) {
      for (const issueType of project.issueTypes) {
        if (this.isIssueTypeInProjects(issueType, projects)) {
          filteredIssueTypes.add(issueType);
        }
      }
    }
    const issueTypes = Array.from(filteredIssueTypes);
    const deduplicatedIssueTypes = this.deduplicateIssueTypes(issueTypes);
    return deduplicatedIssueTypes;
  }

  isIssueTypeInProjects = (issueType: IssueType, projects: Project[]): boolean => {
    const isTeamManagedProject = issueType.scope && issueType.scope.type === 'PROJECT';
    if (isTeamManagedProject) {
      for (const project of projects) {
        if (issueType.scope && issueType.scope.type === 'PROJECT' && issueType.scope.project.id === project.id) {
          return true;
        }
      }
    } else {
      if (issueType.scope) {
        return false;
      } else {
        return true;
      }
    }
    
  }

  filterProjectIssueTypes = (project: Project, allIssueTypes: IssueType[]): IssueType[] => {
    // console.log(`filterProjectIssueTypes:`);
    // console.log(` * project.id: ${project.id}`);
    // console.log(` * project.name: ${project.name}`);
    const filteredIssueTypes: IssueType[] = [];
    const isTeamManagedProject = project.simplified;
    for (const issueType of allIssueTypes) {
      if (isTeamManagedProject) {
        if (issueType.scope && issueType.scope.type === 'PROJECT' && issueType.scope.project.id === project.id) {
          filteredIssueTypes.push(issueType);
        }
      } else {
        if (issueType.scope) {
          // Skip
        } else {
          filteredIssueTypes.push(issueType);
        }
      }
    }
    // console.log(` * returning: ${JSON.stringify(filteredIssueTypes, null, 2)}`);
    return filteredIssueTypes;
  }

  determineProjectsWithIssueTypes = async (subjectIssueType: IssueType, projects: Project[], issueTypes: IssueType[]): Promise<Project[]> => {
    // console.log(`determineProjectsWithIssueTypes:`);
    // console.log(` * subjectIssueType: ${JSON.stringify(subjectIssueType, null, 2)}`);
    // console.log(` * projects: ${JSON.stringify(projects, null, 2)}`);
    // console.log(` * issueTypes: ${JSON.stringify(issueTypes, null, 2)}`);
    const filteredProjects: Project[] = [];
    for (const project of projects) {
      if (this.isIssueTypeInProject(subjectIssueType, project, issueTypes, projects)) {
        filteredProjects.push(project);
      }
    }
    return filteredProjects;
  }

  isIssueTypeInProject = (subjectIssueType: IssueType, subjectProject: Project, issueTypes: IssueType[], projects: Project[]): boolean => {
    const projectIssueTypes = this.getProjectIssueTypes(projects.find(project => project.id === subjectProject.id)!, issueTypes);
    const foundIssueType = projectIssueTypes.find(issueType => issueType.id === subjectIssueType.id || issueType.name === subjectIssueType.name);
    return !!foundIssueType;
  }

  getProjectIssueTypes = (project: Project, issueTypes: IssueType[]): IssueType[] => {
    const isTeamManagedProject = project.simplified;
    if (isTeamManagedProject) {
      const projectIssueTypes: IssueType[] = [];
      for (const issueType of issueTypes) {
        if (issueType.scope && issueType.scope.type === 'PROJECT' && issueType.scope.project.id === project.id) {
          projectIssueTypes.push(issueType);
        }
      }
      return projectIssueTypes;
    } else {
      const filteredIssueTypes: IssueType[] = [];
      for (const issueType of issueTypes) {
        if (!issueType.scope) {
          filteredIssueTypes.push(issueType);
        }
      }
      return filteredIssueTypes;
    }
  }

  getIssueTypesFromIssues = (issues: Issue[]): Map<string, IssueType> => {
    // console.log(`BulkIssueTypeMapping: computing is all issue types are mapped based on selected issues = ${issues.map(issue => issue.key).join(', ')}`);
    const issueTypeIdsToIssueTypes = new Map<string, IssueType>();
    for (const issue of issues) {
      issueTypeIdsToIssueTypes.set(issue.fields.issuetype.id, issue.fields.issuetype);
    }
    return issueTypeIdsToIssueTypes;
  }

  findIsseueByKey = (issues: Issue[], issueKey: string): Issue | undefined => {
    for (const issue of issues) {
      if (issue.key === issueKey) {
        return issue;
      }
    }
    return undefined;
  }
  
  findFieldByName = (fields: IssueBulkEditField[], name: string) => {
    return fields.find(field => field.name === name);
  }

}

export default new JiraUtil();
