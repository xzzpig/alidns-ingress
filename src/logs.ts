import * as log4js from "log4js"
import * as config from "./config"


export const logger = log4js.getLogger('ALIDNS')
logger.level= config.logLevel