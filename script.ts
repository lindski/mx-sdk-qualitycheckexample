import { MendixSdkClient, OnlineWorkingCopy, Project, loadAsPromise } from 'mendixplatformsdk';
import { microflows ,jsonstructures} from 'mendixmodelsdk';
import when = require("when");

const username = 'xxx';
const apikey = 'xxx';
const projectName = 'xxx';
const projectId = 'xxx';
const client = new MendixSdkClient(username, apikey);
var changes = 0;

async function main() {
    const project = new Project(client, projectId, projectName);
    const workingCopy = await project.createWorkingCopy();
    processAllMicroflows(workingCopy);
}

function loadMf(microflow: microflows.IMicroflow): Promise<microflows.Microflow> {
    return microflow.load();
}

function processMF(mf: microflows.Microflow, workingCopy: OnlineWorkingCopy) {
    mf.objectCollection.objects.filter(mf => mf.structureTypeName == 'Microflows$LoopedActivity')
        .forEach(mfloop => {
            const loopedActivity = <microflows.LoopedActivity>mfloop;
            // commit in loop check
            loopedActivity.objectCollection.objects
                .filter(mf=>mf.structureTypeName == 'Microflows$CreateObjectAction' ||
                    mf.structureTypeName == 'Microflows$ChangeObjectAction' ||
                    mf.structureTypeName == 'Microflows$CommitAction')
                .forEach(mfActivity =>{
                    if (mfActivity instanceof microflows.CreateObjectAction){
                        const createObject = <microflows.CreateObjectAction>mfActivity;
                        if(createObject.commit == microflows.CommitEnum.Yes ||
                            createObject.commit == microflows.CommitEnum.YesWithoutEvents){
                                console.log(`!!! COMMIT IN LOOP ${mf.name}`);
                            }
                    } else if (mfActivity instanceof microflows.ChangeObjectAction){
                        const changeObject = <microflows.ChangeObjectAction>mfActivity;
                        if(changeObject.commit == microflows.CommitEnum.Yes ||
                            changeObject.commit == microflows.CommitEnum.YesWithoutEvents){
                                console.log(`!!! COMMIT IN LOOP ${mf.name}`);
                            }
                    } else if (mfActivity instanceof microflows.CommitAction){
                        console.log(`!!! COMMIT IN LOOP ${mf.name}`);
                    }
                })

            loopedActivity.objectCollection.objects
                .filter(mf=>mf.structureTypeName == 'Microflows$ActionActivity')
                .forEach(mfaction =>{
                    if (mfaction instanceof microflows.ActionActivity){
                        const action = mfaction.action;

                        if(action instanceof microflows.RetrieveAction){
                            const retrieveAction = <microflows.RetrieveAction>action;
                            if(retrieveAction.retrieveSource instanceof microflows.DatabaseRetrieveSource){
                                console.log(`!! RETRIEVE FROM DB IN LOOP ${mf.name}`);
                            }
                        }
                    }
                })
        });
}

function loadAllMicroflowsAsPromise(microflows: microflows.IMicroflow[]): when.Promise<microflows.Microflow[]> {
    return when.all<microflows.Microflow[]>(microflows.map(mf => loadAsPromise(mf)));
}

async function processAllMicroflows(workingCopy: OnlineWorkingCopy) {
    loadAllMicroflowsAsPromise(workingCopy.model().allMicroflows())
        .then((microflows) => microflows.forEach((mf) => {
            processMF(mf, workingCopy);
        }))
        .done(async () => {
            if (changes > 0) {
                console.info("Done MF Processing, made " + changes + " change(s)");
                const revision = await workingCopy.commit();
            } else {
                console.info("No changes, skipping commit");
            }
        });
}

main();