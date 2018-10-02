import { setupMountTest } from '../tests/enzyme-util/mount';
import { CreateProjectDialog } from './component';
import { generateManifest } from '../util/generate-manifest';

Math.random = () => .25;
const login = 'test';
localStorage.setItem('rigLogin', JSON.stringify({ login }));

const mockExamples = [{
  title: 'title',
  description: 'description',
  repository: 'repository-owner/repository-name',
  frontendFolderName: 'frontendFolderName',
  backendCommand: 'backendCommand',
  npm: ['npm'],
}];

function mockApiFunctions() {
  const original = require.requireActual('../util/api');
  return {
    ...original,
    createProject: jest.fn().mockImplementation(() => Promise.resolve()),
    fetchExamples: jest.fn().mockImplementation(() => Promise.resolve(mockExamples)),
    fetchExtensionManifest: jest.fn().mockImplementation(() => Promise.resolve({})),
  }
}
jest.mock('../util/api', () => mockApiFunctions());
const api = require.requireMock('../util/api');

describe('<CreateProjectDialog />', () => {
  const setupShallow = setupMountTest(CreateProjectDialog, () => ({
    userId: 'userId',
    closeHandler: jest.fn(),
    saveHandler: jest.fn()
  }));

  it('renders correctly', () => {
    const { wrapper } = setupShallow();
    expect(wrapper).toMatchSnapshot();
  });

  it('expects label-only content', () => {
    const { wrapper } = setupShallow();
    expect(wrapper.find('.project-dialog__dialog').first().text().trim()).toBe('Create New Extension ProjectExtension Project NameChoose ExtensionCreate Local ExtensionUse Already Created Online ExtensionExtension TypesVideo OverlayPanelComponentMobileProject FolderAdd Code to ProjectNone (Only create project folder, if specified)Use Existing ExampleStart from an existing extension example from Twitch or the Developer CommunityTwitch Provided ExamplesCommunity ExamplesComing soon!  Reach out to developers@twitch.tv if you’d like to contribute.SaveCancel');
  });

  it('fetches extension manifest', () => {
    const value = 'value';
    const { wrapper } = setupShallow();
    ['localName', 'projectFolderPath'].forEach((name: string) => {
      wrapper.find('input[name="' + name + '"]').simulate('change', { currentTarget: { name, value } });
    })
    wrapper.find('input[name="isLocal"]').last().simulate('change', { currentTarget: { name: 'isLocal', value: '0' } });
    wrapper.find('.project-dialog-property__button').simulate('click');
    expect(api.fetchExtensionManifest).toHaveBeenCalledTimes(1);
  });

  it('invokes closeHandler when top exit button is clicked', () => {
    const { wrapper } = setupShallow();
    wrapper.find('.project-dialog__escape').simulate('click');
    expect(wrapper.instance().props.closeHandler).toHaveBeenCalled();
  });

  it('invokes closeHandler when cancel button is clicked', () => {
    const { wrapper } = setupShallow();
    wrapper.find('.bottom-bar__cancel').simulate('click');
    expect(wrapper.instance().props.closeHandler).toHaveBeenCalled();
  });

  it('invokes saveHandler when save button is clicked', () => {
    const value = 'value';
    const { wrapper } = setupShallow({
      saveHandler: jest.fn().mockImplementation(() => {
        expect(wrapper.instance().props.saveHandler).toHaveBeenCalledWith({
          backendCommand: '',
          frontendCommand: '',
          frontendFolderName: '',
          isLocal: true,
          manifest: generateManifest('https://localhost.rig.twitch.tv:8080', login, value, ['panel']),
          projectFolderPath: value,
          secret: 'test',
        });
      }),
    });
    ['localName', 'projectFolderPath'].forEach((name: string) => {
      wrapper.find('input[name="' + name + '"]').simulate('change', { currentTarget: { name, value } });
    })
    wrapper.find('input[value="none"]').simulate('change', { currentTarget: { name: 'codeGenerationOption', value: 'none' } });
    wrapper.find('.bottom-bar__save').simulate('click');
  });

  it('saveHandler fails when save button is clicked and createProject fails', async () => {
    const value = 'value';
    let resolvePromise: Function;
    const p = new Promise((resolve, _) => {
      resolvePromise = resolve;
    });
    const { createProject } = api;
    const errorMessage = 'Test: ignore this error';
    api.createProject = jest.fn().mockImplementation(() => {
      resolvePromise();
      return Promise.reject(new Error(errorMessage));
    });
    const { wrapper } = setupShallow();
    ['localName', 'projectFolderPath'].forEach((name: string) => {
      wrapper.find('input[name="' + name + '"]').simulate('change', { currentTarget: { name, value } });
    })
    wrapper.find('input[value="none"]').simulate('change', { currentTarget: { name: 'codeGenerationOption', value: 'none' } });
    wrapper.find('.bottom-bar__save').simulate('click');
    await p;
    api.createProject = createProject;
    expect(wrapper.instance().state.errorMessage).toEqual(errorMessage);
  });

  it('does not invoke saveHandler when save button is clicked', () => {
    const { wrapper } = setupShallow();
    wrapper.find('.bottom-bar__save').simulate('click');
    expect(wrapper.instance().props.saveHandler).not.toHaveBeenCalled();
  });
});
