import chalk from 'chalk';

export class Logger {
  constructor(private verbose: boolean = false) {}

  info(message: string): void {
    console.log(chalk.blue('ℹ') + ' ' + message);
  }

  success(message: string): void {
    console.log(chalk.green('✔') + ' ' + message);
  }

  warn(message: string): void {
    console.log(chalk.yellow('⚠') + ' ' + message);
  }

  error(message: string): void {
    console.error(chalk.red('✖') + ' ' + message);
  }

  debug(message: string): void {
    if (this.verbose) {
      console.log(chalk.gray('…') + ' ' + message);
    }
  }

  section(title: string): void {
    console.log('\n' + chalk.bold.cyan(`── ${title} ──`) + '\n');
  }
}