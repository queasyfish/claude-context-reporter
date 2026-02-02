/**
 * Codebase context extraction utilities
 * These help an AI agent understand the broader codebase context
 */

export interface CodebaseContext {
  /** Related files that might need to be modified */
  relatedFiles: RelatedFile[];
  /** Similar patterns found in the codebase (provided by user config) */
  patterns: PatternReference[];
  /** Project structure hints */
  projectStructure: ProjectStructure;
}

export interface RelatedFile {
  /** Suggested file path based on component name */
  suggestedPath: string;
  /** Type of file */
  type: 'component' | 'hook' | 'api' | 'type' | 'style';
  /** Why this file is relevant */
  reason: string;
}

export interface PatternReference {
  /** Name of the pattern */
  name: string;
  /** Example file that demonstrates this pattern */
  exampleFile?: string;
  /** Description of how to use it */
  description: string;
}

export interface ProjectStructure {
  /** Detected framework */
  framework: 'next' | 'vite' | 'cra' | 'unknown';
  /** Source directory */
  srcDir: string;
  /** Component directory pattern */
  componentPattern: string;
  /** Hook directory pattern */
  hookPattern: string;
  /** API route pattern */
  apiPattern: string;
}

/**
 * Configuration for codebase context (user provides this)
 */
export interface CodebaseConfig {
  /** Base source directory */
  srcDir?: string;
  /** Component location pattern */
  componentDir?: string;
  /** Hooks location pattern */
  hooksDir?: string;
  /** API routes location pattern */
  apiDir?: string;
  /** Types/entities location pattern */
  typesDir?: string;
  /** Pattern examples to include */
  patterns?: {
    modal?: string;
    hook?: string;
    apiRoute?: string;
    component?: string;
  };
  /** Custom context to include in every report */
  customContext?: Record<string, unknown>;
}

/**
 * Generate related file suggestions based on component path
 */
export function suggestRelatedFiles(
  componentPath: Array<{ name: string; sourceLocation?: { fileName: string } }>,
  config: CodebaseConfig = {}
): RelatedFile[] {
  const files: RelatedFile[] = [];
  const srcDir = config.srcDir || 'src';
  const componentDir = config.componentDir || `${srcDir}/components`;
  const hooksDir = config.hooksDir || `${srcDir}/hooks`;
  const apiDir = config.apiDir || `${srcDir}/app/api`;
  const typesDir = config.typesDir || `${srcDir}/types`;

  // Find the most specific component (last non-framework component)
  const appComponents = componentPath.filter(
    (c) =>
      !c.name.includes('Router') &&
      !c.name.includes('Provider') &&
      !c.name.includes('Boundary') &&
      !c.name.includes('Root') &&
      !c.name.includes('Handler') &&
      !c.name.includes('HotReload') &&
      !c.name.includes('Suspense')
  );

  const targetComponent = appComponents[appComponents.length - 1];
  const parentComponent = appComponents[appComponents.length - 2];

  if (targetComponent) {
    // If we have source location, use it
    if (targetComponent.sourceLocation) {
      files.push({
        suggestedPath: targetComponent.sourceLocation.fileName,
        type: 'component',
        reason: `Selected component (from debug source)`,
      });
    } else {
      // Suggest based on component name
      const kebabName = targetComponent.name
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .toLowerCase();

      files.push({
        suggestedPath: `${componentDir}/${targetComponent.name}.tsx`,
        type: 'component',
        reason: `Selected component (guessed path)`,
      });

      files.push({
        suggestedPath: `${componentDir}/${kebabName}/${targetComponent.name}.tsx`,
        type: 'component',
        reason: `Selected component (alternate path with folder)`,
      });
    }

    // Suggest related hook
    files.push({
      suggestedPath: `${hooksDir}/use${targetComponent.name.replace(/Section|Page|Panel|Modal/, '')}.ts`,
      type: 'hook',
      reason: `Potential data hook for this component`,
    });
  }

  if (parentComponent) {
    // Suggest parent component
    if (parentComponent.sourceLocation) {
      files.push({
        suggestedPath: parentComponent.sourceLocation.fileName,
        type: 'component',
        reason: `Parent component (from debug source)`,
      });
    } else {
      files.push({
        suggestedPath: `${componentDir}/${parentComponent.name}.tsx`,
        type: 'component',
        reason: `Parent component (guessed path)`,
      });
    }
  }

  // Add API route suggestion based on context
  files.push({
    suggestedPath: `${apiDir}/[related-entity]/route.ts`,
    type: 'api',
    reason: `API route for data fetching (replace [related-entity])`,
  });

  // Add types suggestion
  files.push({
    suggestedPath: `${typesDir}/index.ts`,
    type: 'type',
    reason: `Type definitions`,
  });

  return files;
}

/**
 * Detect project structure from available signals
 */
export function detectProjectStructure(): ProjectStructure {
  // In browser context, we can't easily detect this
  // This would need to be provided via config
  return {
    framework: 'unknown',
    srcDir: 'src',
    componentPattern: 'src/components/**/*.tsx',
    hookPattern: 'src/hooks/*.ts',
    apiPattern: 'src/app/api/**/*.ts',
  };
}

/**
 * Generate implementation hints based on the selected element
 */
export function generateImplementationHints(
  elementText: string,
  componentName: string,
  config: CodebaseConfig = {}
): string[] {
  const hints: string[] = [];

  // Generic hints
  hints.push(`Look for existing similar features in the codebase to follow patterns`);
  hints.push(`Check if a hook already exists for this data (e.g., use${componentName.replace(/Section|Panel/, '')})`);
  hints.push(`Check existing modals/dialogs for the UI pattern to follow`);

  // If patterns are provided, reference them
  if (config.patterns?.modal) {
    hints.push(`Modal pattern example: ${config.patterns.modal}`);
  }
  if (config.patterns?.hook) {
    hints.push(`Hook pattern example: ${config.patterns.hook}`);
  }

  return hints;
}
