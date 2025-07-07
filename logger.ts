
export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
}

export interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    context: string;
    message: string;
    data?: any;
}

type LogSubscriber = (logEntry: LogEntry) => void;

class LoggerService {
    private logs: LogEntry[] = [];
    private subscribers: Set<LogSubscriber> = new Set();
    private maxLogEntries = 500;

    private addEntry(level: LogLevel, context: string, message: string, data?: any) {
        if (this.logs.length >= this.maxLogEntries) {
            this.logs.shift(); // Keep the log buffer from growing indefinitely
        }

        const logEntry: LogEntry = {
            timestamp: new Date(),
            level,
            context,
            message,
            data,
        };

        this.logs.push(logEntry);

        // Notify subscribers
        this.subscribers.forEach(callback => {
            try {
                callback(logEntry);
            } catch (e) {
                console.error("Error in log subscriber:", e);
            }
        });

        // Also log to console for development
        const consoleArgs = [`[${context}] ${message}`];
        if (data) {
            consoleArgs.push(data);
        }

        switch (level) {
            case LogLevel.DEBUG:
                console.debug(...consoleArgs);
                break;
            case LogLevel.INFO:
                console.info(...consoleArgs);
                break;
            case LogLevel.WARN:
                console.warn(...consoleArgs);
                break;
            case LogLevel.ERROR:
                // For errors, log the full error object for stack trace
                console.error(...consoleArgs);
                break;
        }
    }

    debug(message: string, context = 'General', data?: any) {
        this.addEntry(LogLevel.DEBUG, context, message, data);
    }

    info(message: string, context = 'General', data?: any) {
        this.addEntry(LogLevel.INFO, context, message, data);
    }

    warn(message: string, context = 'General', data?: any) {
        this.addEntry(LogLevel.WARN, context, message, data);
    }

    error(error: any, context = 'General', data?: any) {
        let message: string;
        let errorData: any = { ...data }; // Start with any additional data

        if (error instanceof Error) {
            message = error.message;
            if (!errorData.stack) {
                errorData.stack = error.stack;
            }
        } else if (typeof error === 'string') {
            message = error;
        } else if (typeof error === 'object' && error !== null) {
            // If the object has a message, use it. Otherwise, stringify the object to avoid "[object Object]".
            message = error.message || JSON.stringify(error);
            if (!errorData.originalError) {
               errorData.originalError = error;
            }
        } else {
            message = `Unexpected error type: ${String(error)}`;
        }
        
        this.addEntry(LogLevel.ERROR, context, message, errorData);
    }

    subscribe(callback: LogSubscriber) {
        this.subscribers.add(callback);
    }

    unsubscribe(callback: LogSubscriber) {
        this.subscribers.delete(callback);
    }
    
    getLogs(): LogEntry[] {
        return [...this.logs];
    }

    clear() {
        this.logs = [];
        this.info('Logs cleared', 'Logger');
    }
}

export const Logger = new LoggerService();