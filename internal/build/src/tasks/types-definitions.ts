import process from 'process'
import path from 'path'
import { mkdir, readFile, writeFile } from 'fs/promises'
import consola from 'consola'
import * as vueCompiler from 'vue/compiler-sfc'
import glob from 'fast-glob'
import chalk from 'chalk'
import { Project } from 'ts-morph'
import {
  buildOutput,
  epRoot,
  excludeFiles,
  pkgRoot,
  projRoot,
} from '@element-plus/build-utils'
import { pathRewriter } from '../utils'
import type { CompilerOptions, SourceFile } from 'ts-morph'

const TSCONFIG_PATH = path.resolve(projRoot, 'tsconfig.web.json')
const outDir = path.resolve(buildOutput, 'types')

/**
 * fork = require( https://github.com/egoist/vue-dts-gen/blob/main/src/index.ts
 */
export const generateTypesDefinitions = async () => {
  const compilerOptions: CompilerOptions = {
    emitDeclarationOnly: true,
    outDir,
    baseUrl: projRoot,
    preserveSymlinks: true,
    skipLibCheck: true,
    noImplicitAny: false,
  }
  const project = new Project({
    compilerOptions,
    tsConfigFilePath: TSCONFIG_PATH,
    skipAddingFilesFromTsConfig: true, // 不从tsConfigFilePath添加文件
  })

  const sourceFiles = await addSourceFiles(project) // 手动添加packages文件
  consola.success('Added source files')

  typeCheck(project)
  consola.success('Type check passed!')
  // 此处已按照sourceFiles生成了生命文件，但是源文件用的@element-plus仍然是@element-plus
  await project.emit({
    emitOnlyDtsFiles: true,
  })

  const tasks = sourceFiles.map(async (sourceFile) => {
    const relativePath = path.relative(pkgRoot, sourceFile.getFilePath())
    consola.trace(
      chalk.yellow(
        `Generating definition for file: ${chalk.bold(relativePath)}`
      )
    )

    const emitOutput = sourceFile.getEmitOutput()
    const emitFiles = emitOutput.getOutputFiles()
    if (emitFiles.length === 0) {
      throw new Error(`Emit no file: ${chalk.bold(relativePath)}`)
    }

    const subTasks = emitFiles.map(async (outputFile) => {
      const filepath = outputFile.getFilePath()

      await mkdir(path.dirname(filepath), {
        recursive: true,
      })
      // 覆盖掉之前生成的声明文件，将@element-plus/theme-chalk转换element-plus/theme-chalk ,@element-plus/转换element-plus/es/
      await writeFile(
        filepath,
        pathRewriter('esm')(outputFile.getText()),
        'utf8'
      )

      consola.success(
        chalk.green(
          `Definition for file: ${chalk.bold(relativePath)} generated`
        )
      )
    })

    await Promise.all(subTasks)
  })

  await Promise.all(tasks)
}

async function addSourceFiles(project: Project) {
  project.addSourceFileAtPath(path.resolve(projRoot, 'typings/env.d.ts'))

  const globSourceFile = '**/*.{js?(x),ts?(x),vue}'
  // filePaths返回全路径
  const filePaths = excludeFiles(
    await glob([globSourceFile, '!element-plus/**/*'], {
      cwd: pkgRoot,
      absolute: true,
      onlyFiles: true,
    })
  )
  // element-plus下的文件返回相对路径
  const epPaths = excludeFiles(
    await glob(globSourceFile, {
      cwd: epRoot,
      onlyFiles: true,
    })
  )
  console.log('epPaths', epPaths)
  console.log('filePaths', filePaths)

  const sourceFiles: SourceFile[] = []
  await Promise.all([
    // packages下的文件（排除掉element-plus目录），vue文件提取js内容，然后createSourceFile加入sourceFiles
    ...filePaths.map(async (file) => {
      // vue文件使用vueCompiler编译后提取js内容
      if (file.endsWith('.vue')) {
        const content = await readFile(file, 'utf-8')
        const hasTsNoCheck = content.includes('@ts-nocheck')

        const sfc = vueCompiler.parse(content)
        const { script, scriptSetup } = sfc.descriptor
        if (script || scriptSetup) {
          let content =
            (hasTsNoCheck ? '// @ts-nocheck\n' : '') + (script?.content ?? '')
          // setup需要使用compileScript编译后才能获取到转换后的js代码
          if (scriptSetup) {
            const compiled = vueCompiler.compileScript(sfc.descriptor, {
              id: 'xxx',
            })
            content += compiled.content
          }

          const lang = scriptSetup?.lang || script?.lang || 'js'
          const sourceFile = project.createSourceFile(
            `${path.relative(process.cwd(), file)}.${lang}`,
            content
          )
          sourceFiles.push(sourceFile)
        }
      } else {
        // 非vue文件直接用全路径添加
        const sourceFile = project.addSourceFileAtPath(file)
        sourceFiles.push(sourceFile)
      }
    }),
    // packages/element-plus的文件使用createSourceFile创建，创建声明文件后会放到dist/types/packages文件夹下
    ...epPaths.map(async (file) => {
      const content = await readFile(path.resolve(epRoot, file), 'utf-8')
      sourceFiles.push(
        project.createSourceFile(path.resolve(pkgRoot, file), content)
      )
    }),
  ])

  return sourceFiles
}

function typeCheck(project: Project) {
  const diagnostics = project.getPreEmitDiagnostics()
  if (diagnostics.length > 0) {
    consola.error(project.formatDiagnosticsWithColorAndContext(diagnostics))
    const err = new Error('Failed to generate dts.')
    consola.error(err)
    throw err
  }
}
