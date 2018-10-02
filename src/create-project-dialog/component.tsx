import * as React from 'react';
import * as closeButton from '../img/close_icon.png';
import './component.sass';
import { ExtensionManifest } from '../core/models/manifest';
import { createProject, Example, fetchExamples } from '../util/api';
import { RigProject } from '../core/models/rig';
import { fetchUserExtensionManifest } from '../util/extension';
import { generateManifest } from '../util/generate-manifest';
import { ExtensionViewType } from '../constants/extension-coordinator';
import { PropertyValue } from './property-value';

interface Props {
  userId: string;
  mustSave?: boolean;
  closeHandler: () => void;
  saveHandler: (state: RigProject) => void;
}

interface State {
  rigProject: RigProject;
  localName: string;
  clientId: string;
  version: string;
  codeGenerationOption: string;
  extensionTypes: number;
  scaffoldingOptions: number;
  errorMessage?: string;
  examples: Example[];
  exampleIndex: number;
  [key: string]: number | string | RigProject | Example[];
}

enum CodeGenerationOption {
  None = 'none',
  Scaffolding = 'scaffolding',
  Example = 'example',
}

enum ScaffoldingOptions {
  None = 0,
  StoreConfiguration = 1,
  RetrieveConfiguration = 2,
}

enum ExtensionTypes {
  Panel = 1,
  Component = 2,
  Overlay = 4,
  Mobile = 8,
}

export class CreateProjectDialog extends React.Component<Props, State>{
  private initial: { isMounted: boolean } = { isMounted: false };
  public state: State = {
    rigProject: {
      isLocal: true,
      projectFolderPath: '',
      manifest: {} as ExtensionManifest,
      secret: process.env.EXT_SECRET || '',
      frontendFolderName: '',
      frontendCommand: '',
      backendCommand: '',
    } as RigProject,
    localName: '',
    clientId: process.env.EXT_CLIENT_ID || '',
    version: process.env.EXT_VERSION || '',
    codeGenerationOption: CodeGenerationOption.Example,
    extensionTypes: ExtensionTypes.Panel,
    scaffoldingOptions: ScaffoldingOptions.None,
    examples: [],
    exampleIndex: 0,
  };

  public async componentDidMount() {
    this.initial.isMounted = true;
    const examples = await fetchExamples();
    if (this.initial.isMounted) {
      this.setState({ examples });
    }
  }

  public componentWillUnmount() {
    this.initial.isMounted = false;
  }

  public onChange = (input: React.FormEvent<HTMLInputElement>) => {
    const { name, checked, type, value } = input.currentTarget;
    if (type === 'checkbox') {
      if (typeof this.state[name] === 'boolean') {
        const rigProject = Object.assign(this.state.rigProject, { [name]: checked }) as RigProject;
        this.setState({ rigProject, errorMessage: null });
      } else {
        this.setState((previousState) => {
          const previousValue = previousState[name] as number;
          const numericValue = Number(value);
          if (checked) {
            return { [name]: previousValue | numericValue, errorMessage: null };
          } else {
            return { [name]: previousValue & ~numericValue, errorMessage: null };
          }
        });
      }
    } else if (name !== 'localName' || this.state.rigProject.isLocal) {
      const convert = typeof this.state[name] === 'number' ? (s: string) => Number(s) : (s: string) => s;
      if (Object.getOwnPropertyDescriptor(this.state.rigProject, name)) {
        const rigProject = Object.assign(this.state.rigProject, { [name]: convert(value) }) as RigProject;
        this.setState({ rigProject, errorMessage: null });
      } else {
        this.setState({ [name]: convert(value), errorMessage: null });
      }
    }
  }

  public onChangeExample = (exampleIndex: number) => {
    this.setState({ exampleIndex });
  }

  public onChangeIsLocal = (input: React.FormEvent<HTMLInputElement>) => {
    const target = input.currentTarget;
    const value = Boolean(Number(target.value));
    this.setState((previousState) => {
      const rigProject = Object.assign({}, previousState.rigProject, { isLocal: value });
      return { rigProject };
    });
  }

  private canSave = () => {
    // The project must have a project folder root if the code generation
    // option is not None.
    const { localName, codeGenerationOption, rigProject, extensionTypes } = this.state;
    if (codeGenerationOption !== CodeGenerationOption.None && !rigProject.projectFolderPath.trim()) {
      return false;
    }

    if (rigProject.isLocal) {
      // The project must be named.
      if (!localName.trim()) {
        return false;
      }

      // At least one extension type must be selected.
      if (!extensionTypes) {
        return false;
      }
    } else {
      // An online extension must be selected.
      if (!rigProject.manifest.id) {
        return false;
      }
    }
    return true;
  }

  private getTypes(): string[] {
    const types: string[] = [];
    this.state.extensionTypes & ExtensionTypes.Component && types.push(ExtensionViewType.Component);
    this.state.extensionTypes & ExtensionTypes.Mobile && types.push(ExtensionViewType.Mobile);
    this.state.extensionTypes & ExtensionTypes.Overlay && types.push(ExtensionViewType.Overlay);
    this.state.extensionTypes & ExtensionTypes.Panel && types.push(ExtensionViewType.Panel);
    return types;
  }

  private constructBackendCommand(example: Example) {
    if (this.state.codeGenerationOption === CodeGenerationOption.Example && example.backendCommand) {
      let backendCommand = example.backendCommand
        .replace('{clientId}', this.state.rigProject.manifest.id)
        .replace('{secret}', this.state.rigProject.secret)
        .replace('{ownerId}', this.props.userId);
      if (this.state.rigProject.isLocal) {
        backendCommand += ' -l';
      }
      return backendCommand;
    }
    return '';
  }

  private saveHandler = async () => {
    if (this.canSave()) {
      try {
        this.setState({ errorMessage: 'Creating your project...' });
        if (this.state.rigProject.isLocal) {
          this.state.rigProject.secret = this.state.rigProject.secret || 'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk';
          const ownerName: string = JSON.parse(localStorage.getItem('rigLogin')).login;
          this.state.rigProject.manifest = generateManifest('https://localhost.rig.twitch.tv:8080',
            ownerName, this.state.localName.trim(), this.getTypes());
        }
        const { codeGenerationOption, exampleIndex, examples } = this.state;
        const projectFolderPath = this.state.rigProject.projectFolderPath.trim();
        if (codeGenerationOption !== CodeGenerationOption.None || projectFolderPath) {
          await createProject(projectFolderPath, codeGenerationOption, exampleIndex);
        }
        const example = examples[exampleIndex];
        const rigProject = {
          ...this.state.rigProject,
          frontendFolderName: codeGenerationOption === CodeGenerationOption.Example ? example.frontendFolderName : '',
          frontendCommand: codeGenerationOption === CodeGenerationOption.Example ? example.frontendCommand : '',
          backendCommand: this.constructBackendCommand(example),
        };
        this.props.saveHandler(rigProject as RigProject);
      } catch (ex) {
        console.error(ex);
        this.setState({ errorMessage: ex.message });
      }
    }
  }

  private fetchExtensionManifest = async () => {
    const { clientId, version, rigProject: { isLocal, secret } } = this.state;
    try {
      const manifest = await fetchUserExtensionManifest(isLocal, this.props.userId, secret, clientId, version);
      const rigProject = Object.assign({}, this.state.rigProject, { manifest });
      this.setState({ rigProject });
    } catch (ex) {
      const rigProject = Object.assign({}, this.state.rigProject, { manifest: ex.message });
      this.setState({ rigProject });
    }
  }

  private constructStringClassName(condition: boolean | string, name: string, modifier?: string) {
    return `${name}${modifier ? ` ${name}--${modifier}` : ''}` + (condition ? '' : ` ${name}--error`);
  }

  public render() {
    const pdp = 'project-dialog-property';
    const [pdpi, pdpri] = [`${pdp}__input`, `${pdp}__right-input`];
    const { codeGenerationOption, extensionTypes, rigProject } = this.state;
    const nameInputClassName = this.constructStringClassName(!rigProject.isLocal || this.state.localName.trim(), pdpi, 'half');
    const localName = rigProject.isLocal ? this.state.localName : rigProject.manifest.name || '';
    const typesClassName = this.constructStringClassName(extensionTypes !== 0, `${pdp}__name`);
    const clientIdClassName = this.constructStringClassName(this.state.clientId.trim(), pdpri, 'grid');
    const secretClassName = this.constructStringClassName(rigProject.secret.trim(), pdpri, 'grid');
    const versionClassName = this.constructStringClassName(this.state.version.trim(), pdpri, 'grid');
    const manifestClassName = this.constructStringClassName(rigProject.manifest.id, `${pdp}__textarea`);
    const projectFolderClassName = pdpi +
      (codeGenerationOption === CodeGenerationOption.None || rigProject.projectFolderPath.trim() ? '' : ` ${pdpi}--error`);
    const saveClassName = 'bottom-bar__save' + (this.canSave() ? '' : ' bottom-bar__save--disabled');
    return (
      <div className="project-dialog">
        <div className="project-dialog__background" />
        <div className="project-dialog__dialog">
          <div className="project-dialog__header">
            <div className="project-dialog__title">Create New Extension Project</div>
            {!this.props.mustSave && <div className="project-dialog__escape" onClick={this.props.closeHandler}><img alt="Close" src={closeButton} /></div>}
          </div>
          {this.state.errorMessage && <div>{this.state.errorMessage}</div>}
          <hr className="project-dialog__divider" />
          <div className="project-dialog__body">
            <div className="project-dialog__section project-dialog__section--left">
              <label className="project-dialog-property">
                <div className="project-dialog-property__name">Extension Project Name</div>
                <input className={nameInputClassName} type="text" name="localName" value={localName} onChange={this.onChange} disabled={!rigProject.isLocal} title="Enter a name for your project.  This is set for you for online extensions." />
              </label>
              <div className="project-dialog-property">
                <div className="project-dialog-property__name">Choose Extension</div>
                <PropertyValue type="radio" name="isLocal" value={1} checked={rigProject.isLocal} onChange={this.onChangeIsLocal}
                  text="Create Local Extension" />
                <PropertyValue type="radio" name="isLocal" value={0} checked={!rigProject.isLocal} onChange={this.onChangeIsLocal}
                  text="Use Already Created Online Extension" />
              </div>
              {rigProject.isLocal && <div className="project-dialog-property">
                <div className={typesClassName}>Extension Types</div>
                <PropertyValue type="checkbox" name="extensionTypes" checked={Boolean(extensionTypes & ExtensionTypes.Overlay)} onChange={this.onChange}
                  text="Video Overlay" value={ExtensionTypes.Overlay} />
                <PropertyValue type="checkbox" name="extensionTypes" checked={Boolean(extensionTypes & ExtensionTypes.Panel)} onChange={this.onChange}
                  text="Panel" value={ExtensionTypes.Panel} />
                <PropertyValue type="checkbox" name="extensionTypes" checked={Boolean(extensionTypes & ExtensionTypes.Component)} onChange={this.onChange}
                  text="Component" value={ExtensionTypes.Component} />
                <PropertyValue type="checkbox" name="extensionTypes" checked={Boolean(extensionTypes & ExtensionTypes.Mobile)} onChange={this.onChange}
                  text="Mobile" value={ExtensionTypes.Mobile} />
              </div>}
              {!rigProject.isLocal && <div className="project-dialog-property">
                <PropertyValue isGrid={true} text="Client ID" type={clientIdClassName} name="clientId" value={this.state.clientId} onChange={this.onChange} />
                <PropertyValue isGrid={true} text="Secret" type={secretClassName} name="secret" value={rigProject.secret} onChange={this.onChange} />
                <PropertyValue isGrid={true} text="Version" type={versionClassName} name="version" value={this.state.version} onChange={this.onChange} />
                <button className="project-dialog-property__button" onClick={this.fetchExtensionManifest}>Fetch</button>
                <textarea className={manifestClassName} value={JSON.stringify(rigProject.manifest)} disabled={true} />
              </div>}
              <label className="project-dialog-property" title="This is the folder we will create to contain your project. You must have already created its parent folder.">
                <div className="project-dialog-property__name">Project Folder</div>
                <input className={projectFolderClassName} type="text" name="projectFolderPath" value={rigProject.projectFolderPath} onChange={this.onChange} />
              </label>
              <div className="project-dialog-property">
                <div className="project-dialog-property__name">Add Code to Project</div>
                <PropertyValue type="radio" name="codeGenerationOption" checked={codeGenerationOption === CodeGenerationOption.None} onChange={this.onChange}
                  text="None (Only create project folder, if specified)" value={CodeGenerationOption.None} />
                {false && <PropertyValue type="radio" name="codeGenerationOption" checked={codeGenerationOption === CodeGenerationOption.Scaffolding} onChange={this.onChange}
                  text="Generate Scaffolding" value={CodeGenerationOption.Scaffolding} />}
                <PropertyValue type="radio" name="codeGenerationOption" checked={codeGenerationOption === CodeGenerationOption.Example} onChange={this.onChange}
                  text="Use Existing Example" value={CodeGenerationOption.Example} />
              </div>
            </div>
            <div className="project-dialog__vertical-bar" />
            <div className="project-dialog__section project-dialog__section--right">
              {codeGenerationOption === CodeGenerationOption.Scaffolding ? (
                <>
                  <div className="project-dialog__section-header">Tell us more about what your extension will do</div>
                  <div className="project-dialog__section-text">(We’ll automatically provide basic React-based scaffolding, but we want to provide extras where useful!)</div>
                  <div className="project-dialog__sub-section">
                    <PropertyValue type="checkbox" name="scaffoldingOptions" value={ScaffoldingOptions.StoreConfiguration} checked={Boolean(this.state.scaffoldingOptions)} onChange={this.onChange}
                      text="Store Broadcaster Configuration" />
                    <PropertyValue type="checkbox" name="scaffoldingOptions" value={ScaffoldingOptions.RetrieveConfiguration} checked={Boolean(this.state.scaffoldingOptions & ScaffoldingOptions.RetrieveConfiguration)} onChange={this.onChange}
                      text="Retrieve Configuration on Load" />
                  </div>
                </>
              ) : codeGenerationOption === CodeGenerationOption.Example ? (
                <>
                  <div className="project-dialog__section-header">Start from an existing extension example from Twitch or the Developer Community</div>
                  <label className="project-dialog-property">
                    <div className="project-dialog-property__name">Twitch Provided Examples</div>
                    <div className="project-dialog-property__box">
                      {this.state.examples.map((example, index) => {
                        const className = 'project-dialog-property__option' +
                          (this.state.exampleIndex === index ? ' project-dialog-property__option--selected' : '');
                        return (
                          <div key={index} className={className} onClick={() => this.onChangeExample(index)}>
                            <div className="project-dialog-property__option-title">{example.title}</div>
                            <div className="project-dialog-property__option-description">{example.description}</div>
                          </div>
                        );
                      })}
                    </div>
                  </label>
                  <label className="project-dialog-property">
                    <div className="project-dialog-property__name">Community Examples</div>
                    <div className="project-dialog-property__right-text">Coming soon!  Reach out to developers@twitch.tv if you’d like to contribute.</div>
                  </label>
                </>
              ) : (
                <div className="project-dialog__section-header">You’re all set!  Good luck on your extension!</div>
              )}
            </div>
          </div>
          <hr className="project-dialog__divider" />
          <div className="project-dialog__footer">
            <div className={saveClassName} onClick={this.saveHandler}>Save</div>
            {!this.props.mustSave && (
              <div className="bottom-bar__cancel" onClick={this.props.closeHandler}>Cancel</div>
            )}
          </div>
        </div>
      </div>
    );
  }
}
