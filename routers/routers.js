// ALL Routers 
module.exports = {
    profilePicRouter: require('../server/pictureUpload'),
    bookUploadRouter: require('../server/bookUpload').bookUploadRouter,
    skillsRouter: require('../server/settings/skills'),
    experiencesRouter: require('../server/settings/experiences'),
    projectsRouter: require('../server/settings/projects'),
    projectImagesRouter: require('../server/settings/project_images'),
    certificationsRouter: require('../server/settings/certifications'),
    publicationsRouter: require('../server/settings/publications'),
    educationRouter: require('../server/settings/education'),
    trainingsRouter: require('../server/settings/trainings'),
    contactMessagesRouter: require('../server/settings/contact_messages'),
    auditLogRouter: require('../server/settings/audit_log'),
    profileRouter: require('../server/profile'),
    portfolioPublicRouter: require('../server/portfolio_public')
};
